"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Video, Plus, Pencil, Trash2, GripVertical, Eye, EyeOff,
  ExternalLink, Upload, X, FileVideo, Loader2, Link,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  adminGetTrainingVideos,
  adminCreateTrainingVideo,
  adminUpdateTrainingVideo,
  adminDeleteTrainingVideo,
  adminUploadTrainingVideo,
  getAllTemplates,
} from "@/lib/onboardingApi";
import type { TrainingVideo, OnboardingTemplate } from "@/types/onboarding.types";

const ACCEPTED_VIDEO_TYPES = "video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo,video/x-matroska";
const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB

type SourceMode = "upload" | "url";

type FormState = {
  title: string;
  description: string;
  video_url: string;
  sequence_order: number;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  video_url: "",
  sequence_order: 1,
  is_active: true,
};

export function VideoTrainingManager() {
  // ── Template picker ──────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templatesLoading, setTemplatesLoading] = useState(true);

  // ── Video list ───────────────────────────────────────────────────────────────
  const [videos, setVideos] = useState<TrainingVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TrainingVideo | null>(null);
  const [editTarget, setEditTarget] = useState<TrainingVideo | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // ── Upload state ─────────────────────────────────────────────────────────────
  const [sourceMode, setSourceMode] = useState<SourceMode>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load all templates once on mount
  useEffect(() => {
    getAllTemplates()
      .then((data) => {
        setTemplates(data);
        if (data.length > 0) setSelectedTemplateId(data[0].template_id);
      })
      .catch(() => setError("Failed to load onboarding templates."))
      .finally(() => setTemplatesLoading(false));
  }, []);

  // Load videos whenever selected template changes
  const loadVideos = useCallback(async (templateId: string) => {
    if (!templateId) return;
    setVideosLoading(true);
    setError(null);
    try {
      const data = await adminGetTrainingVideos(templateId);
      setVideos(data);
    } catch {
      setError("Failed to load training videos.");
    } finally {
      setVideosLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTemplateId) loadVideos(selectedTemplateId);
  }, [selectedTemplateId, loadVideos]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const selectedTemplate = templates.find((t) => t.template_id === selectedTemplateId);

  function resetUploadState() {
    setSelectedFile(null);
    setUploadProgress("idle");
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openCreate() {
    if (!selectedTemplateId) return;
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, sequence_order: (videos.length ?? 0) + 1 });
    setSourceMode("upload");
    resetUploadState();
    setDialogOpen(true);
  }

  function openEdit(v: TrainingVideo) {
    setEditTarget(v);
    setForm({
      title: v.title,
      description: v.description ?? "",
      video_url: v.video_url,
      sequence_order: v.sequence_order,
      is_active: v.is_active,
    });
    setSourceMode("url");
    resetUploadState();
    setDialogOpen(true);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    if (file.size > MAX_FILE_BYTES) {
      setUploadError("File exceeds the 100 MB limit. Please use a smaller video.");
      return;
    }
    setSelectedFile(file);
    setUploadProgress("idle");
    setForm((f) => ({ ...f, video_url: "" }));
  }

  function handleFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) { setUploadError("Only video files are accepted."); return; }
    if (file.size > MAX_FILE_BYTES) { setUploadError("File exceeds the 100 MB limit."); return; }
    setSelectedFile(file);
    setUploadProgress("idle");
    setUploadError(null);
    setForm((f) => ({ ...f, video_url: "" }));
  }

  async function handleUploadFile(): Promise<string | null> {
    if (!selectedFile) return null;
    setUploadProgress("uploading");
    setUploadError(null);
    try {
      const result = await adminUploadTrainingVideo(selectedFile);
      setUploadProgress("done");
      return result.url;
    } catch (err: any) {
      setUploadProgress("error");
      setUploadError(err?.message || "Upload failed. Please try again.");
      return null;
    }
  }

  async function handleSave() {
    if (!form.title.trim() || !selectedTemplateId) return;
    setSaving(true);
    setError(null);

    let finalUrl = form.video_url.trim();

    if (sourceMode === "upload" && selectedFile && uploadProgress !== "done") {
      const uploaded = await handleUploadFile();
      if (!uploaded) { setSaving(false); return; }
      finalUrl = uploaded;
    }

    if (!finalUrl) {
      setError("Please provide a video URL or upload a video file.");
      setSaving(false);
      return;
    }

    try {
      if (editTarget) {
        const updated = await adminUpdateTrainingVideo(editTarget.video_id, {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          video_url: finalUrl,
          sequence_order: form.sequence_order,
          is_active: form.is_active,
        });
        setVideos((prev) => prev.map((v) => v.video_id === updated.video_id ? updated : v));
      } else {
        const created = await adminCreateTrainingVideo({
          template_id: selectedTemplateId,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          video_url: finalUrl,
          sequence_order: form.sequence_order,
          is_active: form.is_active,
        });
        setVideos((prev) => [...prev, created].sort((a, b) => a.sequence_order - b.sequence_order));
      }
      setDialogOpen(false);
    } catch (err: any) {
      setError(err?.message || "Failed to save video.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await adminDeleteTrainingVideo(deleteTarget.video_id);
      setVideos((prev) => prev.filter((v) => v.video_id !== deleteTarget.video_id));
      setDeleteTarget(null);
    } catch {
      setError("Failed to delete video.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(v: TrainingVideo) {
    try {
      const updated = await adminUpdateTrainingVideo(v.video_id, { is_active: !v.is_active });
      setVideos((prev) => prev.map((vid) => vid.video_id === updated.video_id ? updated : vid));
    } catch {
      setError("Failed to update video status.");
    }
  }

  const sortedVideos = [...videos].sort((a, b) => a.sequence_order - b.sequence_order);
  const canSave = !!form.title.trim() && (
    (sourceMode === "upload" && (!!selectedFile || uploadProgress === "done")) ||
    (sourceMode === "url" && !!form.video_url.trim()) ||
    !!editTarget
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold text-slate-800 text-base flex items-center gap-2">
            <Video className="size-4 text-blue-600" />
            Training Videos
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Assign videos per onboarding template. Each job position gets its own training playlist.
          </p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</div>
      )}

      {/* Template picker */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-1.5">
        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Select Onboarding Template (Job Position)
        </Label>
        {templatesLoading ? (
          <p className="text-sm text-slate-400 animate-pulse">Loading templates…</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-slate-400">No templates found. Create an onboarding template first.</p>
        ) : (
          <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Choose a template…" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.template_id} value={t.template_id}>
                  <span className="font-medium">{t.name}</span>
                  {(t.position_name || t.department_name) && (
                    <span className="ml-2 text-xs text-slate-400">
                      {[t.position_name, t.department_name].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Video list for selected template */}
      {selectedTemplateId && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-700">
              Videos for <span className="text-blue-700">{selectedTemplate?.name ?? "—"}</span>
              <span className="ml-2 text-xs text-slate-400">({sortedVideos.length} video{sortedVideos.length !== 1 ? "s" : ""})</span>
            </p>
            <Button size="sm" onClick={openCreate} className="gap-1.5" disabled={!selectedTemplateId}>
              <Plus className="size-4" /> Add Video
            </Button>
          </div>

          {videosLoading ? (
            <div className="text-sm text-muted-foreground animate-pulse py-6 text-center">Loading…</div>
          ) : sortedVideos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 border-2 border-dashed border-slate-200 rounded-xl">
              <Video className="size-10 text-slate-300" />
              <p className="text-sm text-slate-400">No videos for this template yet.</p>
              <Button size="sm" variant="outline" onClick={openCreate} className="gap-1.5">
                <Plus className="size-4" /> Add First Video
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedVideos.map((v, idx) => (
                <div key={v.video_id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <GripVertical className="size-4 text-slate-300 mt-1 shrink-0" />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-400">#{idx + 1}</span>
                      <span className="font-medium text-slate-800 truncate">{v.title}</span>
                      {v.is_active
                        ? <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">Active</Badge>
                        : <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-xs">Inactive</Badge>
                      }
                    </div>
                    {v.description && <p className="text-xs text-slate-500 truncate">{v.description}</p>}
                    <a href={v.video_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline flex items-center gap-1 truncate">
                      <ExternalLink className="size-3 shrink-0" />{v.video_url}
                    </a>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="size-8 text-slate-400 hover:text-slate-600"
                      title={v.is_active ? "Deactivate" : "Activate"} onClick={() => toggleActive(v)}>
                      {v.is_active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="size-8 text-slate-400 hover:text-slate-600" onClick={() => openEdit(v)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-8 text-red-400 hover:text-red-600" onClick={() => setDeleteTarget(v)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Create / Edit dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetUploadState(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Training Video" : "Add Training Video"}</DialogTitle>
            <DialogDescription>
              {editTarget
                ? `Editing video for template: ${selectedTemplate?.name}`
                : `Adding video for template: ${selectedTemplate?.name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Title <span className="text-red-500">*</span></Label>
              <Input placeholder="e.g. Company Safety Orientation"
                value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea placeholder="Brief description…" rows={2}
                value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Video Source <span className="text-red-500">*</span></Label>

              {!editTarget && (
                <div className="flex gap-2">
                  {(["upload", "url"] as SourceMode[]).map((mode) => (
                    <button key={mode} type="button"
                      onClick={() => { setSourceMode(mode); resetUploadState(); if (mode === "upload") setForm((f) => ({ ...f, video_url: "" })); }}
                      className={["flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all",
                        sourceMode === mode ? "bg-blue-50 border-blue-400 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300",
                      ].join(" ")}>
                      {mode === "upload" ? <><Upload className="size-3.5" /> Upload File</> : <><Link className="size-3.5" /> Paste URL</>}
                    </button>
                  ))}
                </div>
              )}

              {sourceMode === "upload" && !editTarget && (
                <div>
                  {!selectedFile ? (
                    <div onDrop={handleFileDrop} onDragOver={(e) => e.preventDefault()}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-all">
                      <div className="size-10 rounded-xl bg-slate-100 flex items-center justify-center">
                        <FileVideo className="size-5 text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-600">Click to browse or drag &amp; drop</p>
                      <p className="text-xs text-slate-400">MP4, WebM, MOV, AVI, MKV · Max 100 MB</p>
                      <input ref={fileInputRef} type="file" accept={ACCEPTED_VIDEO_TYPES} className="hidden" onChange={handleFileChange} />
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 bg-slate-50">
                      <FileVideo className="size-5 text-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{selectedFile.name}</p>
                        <p className="text-xs text-slate-400">{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                      </div>
                      {uploadProgress === "uploading" && <Loader2 className="size-4 text-blue-500 animate-spin shrink-0" />}
                      {uploadProgress === "done" && <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">Uploaded</Badge>}
                      {uploadProgress !== "uploading" && uploadProgress !== "done" && (
                        <Button size="icon" variant="ghost" className="size-7 text-slate-400 hover:text-red-500 shrink-0" onClick={resetUploadState}>
                          <X className="size-4" />
                        </Button>
                      )}
                    </div>
                  )}
                  {uploadError && <p className="text-xs text-red-600 mt-1">{uploadError}</p>}
                </div>
              )}

              {(sourceMode === "url" || editTarget) && (
                <div className="space-y-1">
                  <Input placeholder="https://example.com/video.mp4  or  YouTube/Vimeo embed URL"
                    value={form.video_url} onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))} />
                  <p className="text-xs text-slate-400">Accepts direct MP4/WebM links or YouTube/Vimeo embed URLs.</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sequence Order</Label>
                <Input type="number" min={1} value={form.sequence_order}
                  onChange={(e) => setForm((f) => ({ ...f, sequence_order: parseInt(e.target.value) || 1 }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <div className="flex items-center gap-2 h-9">
                  <input id="is_active_chk" type="checkbox" checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                    className="rounded border-slate-300" />
                  <label htmlFor="is_active_chk" className="text-sm text-slate-700 select-none cursor-pointer">Active</label>
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetUploadState(); }}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !canSave} className="gap-1.5">
                {saving && <Loader2 className="size-3.5 animate-spin" />}
                {saving ? "Saving…" : editTarget ? "Save Changes" : "Add Video"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Training Video?</DialogTitle>
            <DialogDescription>
              This will permanently remove <strong>{deleteTarget?.title}</strong> and all applicant
              progress records for it. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={saving} onClick={handleDelete}>
              {saving ? "Deleting…" : "Delete Video"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
