"use client";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Settings,
  FileCheck,
  ListChecks,
  Package,
  Plus,
  Eye,
  Search,
  Building,
  ClipboardList,
  LayoutTemplate,
  Save,
  Info,
  FileStack,
  Trash2,
  X,
  Video,
  Image as ImageIcon,
  Paperclip,
  Youtube,
  ExternalLink,
  CheckSquare2,
  FileText,
  FileSpreadsheet,
  Clock,
  Upload,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import type { OnboardingTemplate, JobPosition, Department } from "@/types/onboarding.types";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  getAllTemplates,
  createTemplate,
  getAllPositions,
  createPosition,
  getDepartments,
  addTemplateItem,
  updateTemplateItem,
  deleteTemplateItem,
  uploadTemplateImage,
} from "@/lib/onboardingApi";

interface RichContent {
  videoLinks?: string[];
  imageUrls?: string[];
  fileLinks?: Array<{ name: string; url: string }>;
}

function parseRichContent(rc?: string): RichContent {
  if (!rc) return {};
  try {
    return JSON.parse(rc);
  } catch {
    return {};
  }
}

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function hasRichContent(rc: RichContent): boolean {
  return !!(rc.videoLinks?.length || rc.imageUrls?.length || rc.fileLinks?.length);
}

const CAT_CONFIG = {
  documents: { label: "Document", plural: "Documents", icon: FileText, tabIcon: FileCheck },
  tasks:     { label: "Task",     plural: "Tasks",     icon: CheckSquare2, tabIcon: ListChecks },
  equipment: { label: "Equipment",plural: "Equipment", icon: Package,      tabIcon: Package },
  hr_forms:  { label: "HR Form",  plural: "HR Forms",  icon: FileSpreadsheet, tabIcon: ClipboardList },
} as const;

export default function SystemAdminView() {
  const [templates, setTemplates]               = useState<OnboardingTemplate[]>([]);
  const [departments, setDepartments]           = useState<Department[]>([]);
  const [positions, setPositions]               = useState<JobPosition[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<OnboardingTemplate | null>(null);
  const [searchQuery, setSearchQuery]           = useState("");

  // New template
  const [showNewTemplateDialog, setShowNewTemplateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName]             = useState("");
  const [newTemplateDepartment, setNewTemplateDepartment] = useState("");
  const [newTemplatePosition, setNewTemplatePosition]     = useState("");
  const [newTemplateDeadline, setNewTemplateDeadline]     = useState("7");
  const [creatingTemplate, setCreatingTemplate]           = useState(false);

  // Item editing
  const [addItemCategory, setAddItemCategory] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle]         = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemRequired, setNewItemRequired]   = useState(false);
  const [savingNewItem, setSavingNewItem]       = useState(false);
  const [togglingItemId, setTogglingItemId]     = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId]     = useState<string | null>(null);

  // Rich content (tasks)
  const [newItemVideoLinks, setNewItemVideoLinks] = useState<string[]>([]);
  const [newItemImageUrls, setNewItemImageUrls]   = useState<string[]>([]);
  const [newItemFileLinks, setNewItemFileLinks]   = useState<{ name: string; url: string }[]>([]);
  const [uploadingTemplateImage, setUploadingTemplateImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null);

  // New position
  const [showNewPositionDialog, setShowNewPositionDialog] = useState(false);
  const [newPositionTitle, setNewPositionTitle]           = useState("");
  const [newPositionDepartment, setNewPositionDepartment] = useState("");

  useEffect(() => {
    getAllTemplates().then(setTemplates).catch(console.error);
    getDepartments().then(setDepartments).catch(console.error);
    getAllPositions().then(setPositions).catch(console.error);
  }, []);

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim() || !newTemplateDepartment || !newTemplatePosition) return;
    setCreatingTemplate(true);
    try {
      await createTemplate({
        name: newTemplateName.trim(),
        department_id: newTemplateDepartment,
        position_id: newTemplatePosition,
        default_deadline_days: parseInt(newTemplateDeadline),
        items: [],
      });
      const updated = await getAllTemplates();
      setTemplates(updated);
      setNewTemplateName(""); setNewTemplateDepartment(""); setNewTemplatePosition(""); setNewTemplateDeadline("7");
      setShowNewTemplateDialog(false);
    } catch (err) { console.error(err); }
    finally { setCreatingTemplate(false); }
  };

  const handleCreatePosition = async () => {
    if (!newPositionTitle.trim() || !newPositionDepartment) return;
    try {
      await createPosition(newPositionDepartment, newPositionTitle);
      const updated = await getAllPositions();
      setPositions(updated);
    } catch (err) { console.error(err); }
    setNewPositionTitle(""); setNewPositionDepartment(""); setShowNewPositionDialog(false);
  };

  const typeForCategory: Record<string, string> = {
    documents: "upload", tasks: "task", equipment: "equipment", hr_forms: "form",
  };

  function resetAddItemForm() {
    setNewItemTitle(""); setNewItemDescription(""); setNewItemRequired(false);
    setNewItemVideoLinks([]); setNewItemImageUrls([]); setNewItemFileLinks([]);
    setUploadingTemplateImage(false); setImageUploadError(null);
    setAddItemCategory(null);
  }

  const handleAddTemplateItem = async (tab_category: string) => {
    if (!selectedTemplate || !newItemTitle.trim()) return;
    setSavingNewItem(true);
    try {
      let richContent: string | undefined;
      if (tab_category === "tasks") {
        const rc: RichContent = {};
        const vids  = newItemVideoLinks.filter((v) => v.trim());
        const imgs  = newItemImageUrls.filter((v) => v.trim());
        const files = newItemFileLinks.filter((f) => f.url.trim());
        if (vids.length)  rc.videoLinks = vids;
        if (imgs.length)  rc.imageUrls  = imgs;
        if (files.length) rc.fileLinks  = files;
        if (Object.keys(rc).length) richContent = JSON.stringify(rc);
      }

      const item = await addTemplateItem(selectedTemplate.template_id, {
        type: typeForCategory[tab_category] ?? tab_category,
        tab_category,
        title: newItemTitle.trim(),
        description: newItemDescription.trim() || undefined,
        is_required: newItemRequired,
        rich_content: richContent,
      });

      const merged = richContent ? { ...item, rich_content: richContent } : item;
      const append = (t: typeof selectedTemplate) => ({ ...t, template_items: [...t.template_items, merged] });
      setSelectedTemplate((prev) => (prev ? append(prev) : prev));
      setTemplates((prev) => prev.map((t) => (t.template_id === selectedTemplate.template_id ? append(t) : t)));
      resetAddItemForm();
    } catch (err) { console.error(err); }
    finally { setSavingNewItem(false); }
  };

  const handleToggleRequired = async (itemId: string, current: boolean) => {
    if (!selectedTemplate) return;
    setTogglingItemId(itemId);
    try {
      await updateTemplateItem(itemId, { is_required: !current });
      const toggle = (items: typeof selectedTemplate.template_items) =>
        items.map((i) => (i.item_id === itemId ? { ...i, is_required: !current } : i));
      setSelectedTemplate((prev) => (prev ? { ...prev, template_items: toggle(prev.template_items) } : prev));
      setTemplates((prev) =>
        prev.map((t) =>
          t.template_id === selectedTemplate.template_id ? { ...t, template_items: toggle(t.template_items) } : t,
        ),
      );
    } catch (err) { console.error(err); }
    finally { setTogglingItemId(null); }
  };

  const handleDeleteTemplateItem = async (itemId: string) => {
    if (!selectedTemplate) return;
    setDeletingItemId(itemId);
    try {
      await deleteTemplateItem(itemId);
      const remove = (items: typeof selectedTemplate.template_items) =>
        items.filter((i) => i.item_id !== itemId);
      setSelectedTemplate((prev) => (prev ? { ...prev, template_items: remove(prev.template_items) } : prev));
      setTemplates((prev) =>
        prev.map((t) =>
          t.template_id === selectedTemplate.template_id ? { ...t, template_items: remove(t.template_items) } : t,
        ),
      );
    } catch (err) { console.error(err); }
    finally { setDeletingItemId(null); }
  };

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.department_name ?? t.department_id).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.position_name ?? t.position_id).toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalTemplateItems = templates.reduce((sum, t) => sum + t.template_items.length, 0);

  // Rich content helpers
  const addVideoLink    = () => setNewItemVideoLinks((p) => [...p, ""]);
  const updateVideoLink = (i: number, v: string) => setNewItemVideoLinks((p) => p.map((x, idx) => idx === i ? v : x));
  const removeVideoLink = (i: number) => setNewItemVideoLinks((p) => p.filter((_, idx) => idx !== i));

  const addImageUrl    = () => setNewItemImageUrls((p) => [...p, ""]);
  const updateImageUrl = (i: number, v: string) => setNewItemImageUrls((p) => p.map((x, idx) => idx === i ? v : x));
  const removeImageUrl = (i: number) => setNewItemImageUrls((p) => p.filter((_, idx) => idx !== i));

  const handleTemplateImageUpload = async (file: File | null | undefined) => {
    if (!file) return;
    setUploadingTemplateImage(true);
    setImageUploadError(null);
    try {
      const uploaded = await uploadTemplateImage(file);
      setNewItemImageUrls((prev) => [...prev, uploaded.url]);
    } catch (err) {
      setImageUploadError(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setUploadingTemplateImage(false);
      if (imageUploadInputRef.current) imageUploadInputRef.current.value = "";
    }
  };

  const addFileLink    = () => setNewItemFileLinks((p) => [...p, { name: "", url: "" }]);
  const updateFileLink = (i: number, field: "name" | "url", v: string) =>
    setNewItemFileLinks((p) => p.map((f, idx) => idx === i ? { ...f, [field]: v } : f));
  const removeFileLink = (i: number) => setNewItemFileLinks((p) => p.filter((_, idx) => idx !== i));

  return (
    <div className="min-h-screen bg-slate-50/60 p-6 animate-in fade-in duration-500">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Hero ── */}
        <div className="rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 py-7 relative overflow-hidden">
          <div className="absolute top-0 right-0 size-72 rounded-full bg-blue-400/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 size-48 rounded-full bg-teal-400/10 blur-3xl pointer-events-none" />
          <div className="relative flex items-center gap-4">
            <div className="flex items-center justify-center size-12 rounded-xl bg-white/10 shrink-0">
              <Settings className="size-6 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300 mb-0.5">Configuration</p>
              <h1 className="text-2xl font-bold text-white leading-tight">System Administration</h1>
              <p className="text-sm text-blue-100/70 mt-0.5">Manage onboarding templates, departments, and system settings</p>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {([
            { label: "Templates",      value: templates.length,    sub: "Onboarding templates", icon: LayoutTemplate, bg: "bg-blue-100",    fg: "text-blue-600" },
            { label: "Departments",    value: departments.length,  sub: "Active departments",   icon: Building,       bg: "bg-indigo-100",  fg: "text-indigo-600" },
            { label: "Positions",      value: positions.length,    sub: "Position types",       icon: ClipboardList,  bg: "bg-violet-100",  fg: "text-violet-600" },
            { label: "Template Items", value: totalTemplateItems,  sub: "Across all templates", icon: FileStack,      bg: "bg-emerald-100", fg: "text-emerald-600" },
          ] as const).map(({ label, value, sub, icon: Icon, bg, fg }) => (
            <Card key={label} className="border shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                    <div className="text-3xl font-bold mt-1">{value}</div>
                    <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                  </div>
                  <div className={cn("flex items-center justify-center size-12 rounded-xl shrink-0", bg)}>
                    <Icon className={cn("size-5", fg)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Main Config ── */}
        <Card className="border shadow-sm">
          <CardContent className="p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold tracking-tight">System Configuration</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Configure onboarding templates, departments, and positions</p>
            </div>

            <Tabs defaultValue="templates">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="templates" className="gap-2"><LayoutTemplate className="size-4" />Onboarding Templates</TabsTrigger>
                <TabsTrigger value="departments" className="gap-2"><Building className="size-4" />Departments</TabsTrigger>
                <TabsTrigger value="positions" className="gap-2"><ClipboardList className="size-4" />Positions</TabsTrigger>
              </TabsList>

              {/* Templates tab */}
              <TabsContent value="templates" className="space-y-4 mt-2">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input placeholder="Search templates..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
                  </div>
                  <Button onClick={() => setShowNewTemplateDialog(true)}>
                    <Plus className="size-4 mr-2" />New Template
                  </Button>
                </div>

                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        {["Template Name","Department","Position","Docs","Tasks","Equipment","HR Forms","Deadline","Actions"].map((h) => (
                          <TableHead key={h} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-3">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTemplates.map((template) => (
                        <TableRow key={template.template_id} className="hover:bg-primary/5 transition-colors">
                          <TableCell className="font-medium">{template.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{template.department_name ?? template.department_id}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{template.position_name ?? template.position_id}</TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                              {template.template_items.filter((i) => i.tab_category === "documents").length}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                              {template.template_items.filter((i) => i.tab_category === "tasks").length}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-violet-50 text-violet-700 border border-violet-200 font-semibold">
                              {template.template_items.filter((i) => i.tab_category === "equipment").length}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                              {template.template_items.filter((i) => i.tab_category === "hr_forms").length}
                            </Badge>
                          </TableCell>
                          <TableCell><span className="text-sm font-medium">{template.default_deadline_days} days</span></TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" onClick={() => setSelectedTemplate(template)} className="gap-1.5 text-xs cursor-pointer">
                              <Eye className="size-3" />View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredTemplates.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="py-16 text-center">
                            <div className="flex flex-col items-center gap-3 text-muted-foreground">
                              <div className="size-12 rounded-xl bg-muted flex items-center justify-center">
                                <LayoutTemplate className="size-6 opacity-40" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">No templates found</p>
                                <p className="text-xs mt-0.5">{searchQuery ? "Try a different search term" : "Create your first onboarding template to get started"}</p>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Departments tab */}
              <TabsContent value="departments" className="space-y-4 mt-2">
                <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <Info className="size-4 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-800">Departments are managed at the database level. Contact your database administrator to add or modify departments.</p>
                </div>
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-3">Department Name</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-3">Company ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {departments.map((dept) => (
                        <TableRow key={dept.department_id} className="hover:bg-primary/5 transition-colors">
                          <TableCell className="font-medium">{dept.department_name}</TableCell>
                          <TableCell><Badge variant="secondary" className="font-mono text-xs">{dept.company_id}</Badge></TableCell>
                        </TableRow>
                      ))}
                      {departments.length === 0 && (
                        <TableRow><TableCell colSpan={2} className="py-16 text-center">
                          <div className="flex flex-col items-center gap-3 text-muted-foreground">
                            <div className="size-12 rounded-xl bg-muted flex items-center justify-center"><Building className="size-6 opacity-40" /></div>
                            <p className="text-sm font-medium">No departments found</p>
                          </div>
                        </TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Positions tab */}
              <TabsContent value="positions" className="space-y-4 mt-2">
                <div className="flex justify-end">
                  <Button onClick={() => setShowNewPositionDialog(true)}><Plus className="size-4 mr-2" />Add Position</Button>
                </div>
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-3">Position Title</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-3">Department</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {positions.map((pos) => (
                        <TableRow key={pos.position_id} className="hover:bg-primary/5 transition-colors">
                          <TableCell className="font-medium">{pos.position_name}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{pos.department_name ?? pos.department_id}</Badge></TableCell>
                        </TableRow>
                      ))}
                      {positions.length === 0 && (
                        <TableRow><TableCell colSpan={2} className="py-16 text-center">
                          <div className="flex flex-col items-center gap-3 text-muted-foreground">
                            <div className="size-12 rounded-xl bg-muted flex items-center justify-center"><ClipboardList className="size-6 opacity-40" /></div>
                            <div><p className="text-sm font-medium">No positions defined</p><p className="text-xs mt-0.5">Add a position to link with onboarding templates</p></div>
                          </div>
                        </TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Template Detail Dialog — redesigned                        */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Dialog open={!!selectedTemplate} onOpenChange={(open) => { if (!open) { setSelectedTemplate(null); resetAddItemForm(); } }}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0">

          {/* Dialog header with template info chips */}
          <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center size-10 rounded-xl bg-blue-100 shrink-0 mt-0.5">
                <LayoutTemplate className="size-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-bold leading-tight">{selectedTemplate?.name}</DialogTitle>
                <DialogDescription className="sr-only">Onboarding template detail view</DialogDescription>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {selectedTemplate?.department_name && (
                    <span className="inline-flex items-center gap-1 rounded-full border bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                      <Building className="size-3" />{selectedTemplate.department_name}
                    </span>
                  )}
                  {selectedTemplate?.position_name && (
                    <span className="inline-flex items-center gap-1 rounded-full border bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                      <ClipboardList className="size-3" />{selectedTemplate.position_name}
                    </span>
                  )}
                  {selectedTemplate?.default_deadline_days && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
                      <Clock className="size-3" />{selectedTemplate.default_deadline_days}-day deadline
                    </span>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          {selectedTemplate && (
            <div className="flex-1 overflow-y-auto">
              <Tabs
                defaultValue="documents"
                onValueChange={() => resetAddItemForm()}
                className="flex flex-col h-full"
              >
                {/* Tabs strip */}
                <div className="px-6 pt-4 pb-0 border-b shrink-0">
                  <TabsList className="grid grid-cols-4 w-full">
                    {(["documents", "tasks", "equipment", "hr_forms"] as const).map((cat) => {
                      const cfg = CAT_CONFIG[cat];
                      const count = selectedTemplate.template_items.filter((i) => i.tab_category === cat).length;
                      return (
                        <TabsTrigger key={cat} value={cat} className="gap-1.5 text-xs">
                          <cfg.tabIcon className="size-3.5" />
                          {cfg.plural}
                          <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums">{count}</span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </div>

                {/* Tab contents */}
                {(["documents", "tasks", "equipment", "hr_forms"] as const).map((cat) => {
                  const cfg = CAT_CONFIG[cat];
                  const items = selectedTemplate.template_items.filter((i) => i.tab_category === cat);
                  const isTask = cat === "tasks";

                  return (
                    <TabsContent key={cat} value={cat} className="flex-1 px-6 py-4 space-y-3 mt-0">
                      {/* Add button */}
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 cursor-pointer"
                          onClick={() => { resetAddItemForm(); setAddItemCategory(cat); }}
                        >
                          <Plus className="size-3.5" />Add {cfg.label}
                        </Button>
                      </div>

                      {/* Item cards */}
                      <div className="space-y-2">
                        {items.map((item) => {
                          const rc = parseRichContent(item.rich_content);
                          const isDeleting = deletingItemId === item.item_id;
                          const isToggling = togglingItemId === item.item_id;

                          return (
                            <div
                              key={item.item_id}
                              className={cn(
                                "group relative rounded-xl border bg-white p-4 hover:border-primary/25 hover:shadow-sm transition-all duration-200",
                                isDeleting && "opacity-50 pointer-events-none",
                              )}
                            >
                              <div className="flex items-start gap-3">
                                {/* Category icon */}
                                <div className={cn(
                                  "flex items-center justify-center size-8 rounded-lg shrink-0 mt-0.5",
                                  cat === "documents" && "bg-blue-50",
                                  cat === "tasks"     && "bg-amber-50",
                                  cat === "equipment" && "bg-violet-50",
                                  cat === "hr_forms"  && "bg-emerald-50",
                                )}>
                                  <cfg.icon className={cn(
                                    "size-4",
                                    cat === "documents" && "text-blue-600",
                                    cat === "tasks"     && "text-amber-600",
                                    cat === "equipment" && "text-violet-600",
                                    cat === "hr_forms"  && "text-emerald-600",
                                  )} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-sm">{item.title}</span>
                                    <button
                                      onClick={() => handleToggleRequired(item.item_id, item.is_required)}
                                      disabled={isToggling}
                                      className={cn(
                                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border transition-colors cursor-pointer",
                                        item.is_required
                                          ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                                          : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100",
                                        isToggling && "opacity-50 cursor-not-allowed",
                                      )}
                                    >
                                      {isToggling ? "…" : item.is_required ? "Required" : "Optional"}
                                    </button>
                                  </div>

                                  {item.description && (
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
                                  )}

                                  {/* Rich content display (tasks only) */}
                                  {isTask && hasRichContent(rc) && (
                                    <div className="mt-3 space-y-2.5">
                                      {/* Video links */}
                                      {rc.videoLinks && rc.videoLinks.length > 0 && (
                                        <div className="space-y-1.5">
                                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Videos</p>
                                          <div className="flex flex-wrap gap-2">
                                            {rc.videoLinks.map((url, vi) => {
                                              const ytId = getYouTubeId(url);
                                              return ytId ? (
                                                <a key={vi} href={url} target="_blank" rel="noopener noreferrer"
                                                  className="flex items-center gap-0 rounded-lg border overflow-hidden hover:border-red-300 hover:shadow-sm transition-all max-w-[220px]">
                                                  <img
                                                    src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                                                    alt="YouTube thumbnail"
                                                    className="w-[72px] h-12 object-cover shrink-0"
                                                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                                  />
                                                  <div className="px-2.5 py-1 flex-1 min-w-0">
                                                    <div className="flex items-center gap-1 text-[10px] font-bold text-red-600">
                                                      <Youtube className="size-3 shrink-0" />YouTube
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground truncate">{url.replace(/https?:\/\/(www\.)?/, "")}</p>
                                                  </div>
                                                </a>
                                              ) : (
                                                <a key={vi} href={url} target="_blank" rel="noopener noreferrer"
                                                  className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 hover:bg-muted/50 transition-colors max-w-[200px]">
                                                  <Video className="size-3.5 text-blue-500 shrink-0" />
                                                  <span className="text-xs text-blue-600 truncate">{url.replace(/https?:\/\//, "")}</span>
                                                  <ExternalLink className="size-3 text-muted-foreground shrink-0" />
                                                </a>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}

                                      {/* Images */}
                                      {rc.imageUrls && rc.imageUrls.length > 0 && (
                                        <div className="space-y-1.5">
                                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Images</p>
                                          <div className="flex flex-wrap gap-2">
                                            {rc.imageUrls.map((url, ii) => (
                                              <a key={ii} href={url} target="_blank" rel="noopener noreferrer"
                                                className="block size-16 rounded-lg overflow-hidden border hover:border-primary/40 hover:shadow-sm transition-all bg-muted">
                                                <img
                                                  src={url}
                                                  alt={`Image ${ii + 1}`}
                                                  className="w-full h-full object-cover"
                                                  onError={(e) => {
                                                    const el = e.currentTarget as HTMLImageElement;
                                                    el.style.display = "none";
                                                    if (el.parentElement) {
                                                      el.parentElement.innerHTML =
                                                        '<div class="w-full h-full flex items-center justify-center text-muted-foreground/50 text-[10px] text-center p-1">No preview</div>';
                                                    }
                                                  }}
                                                />
                                              </a>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* File links */}
                                      {rc.fileLinks && rc.fileLinks.length > 0 && (
                                        <div className="space-y-1.5">
                                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Files</p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {rc.fileLinks.map((file, fi) => (
                                              <a key={fi} href={file.url} target="_blank" rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs hover:bg-muted/60 transition-colors group/file">
                                                <Paperclip className="size-3 text-muted-foreground shrink-0" />
                                                <span className="font-medium text-foreground">{file.name || "File"}</span>
                                                <ExternalLink className="size-2.5 text-muted-foreground group-hover/file:text-foreground transition-colors" />
                                              </a>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Delete button — visible on hover */}
                                <button
                                  onClick={() => handleDeleteTemplateItem(item.item_id)}
                                  disabled={isDeleting}
                                  aria-label="Delete item"
                                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 text-muted-foreground cursor-pointer"
                                >
                                  {isDeleting
                                    ? <span className="text-[10px]">…</span>
                                    : <Trash2 className="size-3.5" />
                                  }
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {/* Empty state */}
                        {items.length === 0 && !addItemCategory && (
                          <div className="rounded-xl border border-dashed py-12 text-center">
                            <div className="flex flex-col items-center gap-3 text-muted-foreground">
                              <div className="size-12 rounded-xl bg-muted flex items-center justify-center">
                                <cfg.icon className="size-6 opacity-40" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">No {cfg.plural.toLowerCase()} yet</p>
                                <p className="text-xs mt-0.5">Click &ldquo;Add {cfg.label}&rdquo; above to add one</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ── Add item form ── */}
                      {addItemCategory === cat && (
                        <div className="rounded-xl border bg-slate-50 overflow-hidden mt-2">
                          {/* Form header */}
                          <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
                            <p className="text-sm font-semibold">New {cfg.label}</p>
                            <button onClick={resetAddItemForm} className="p-1 rounded hover:bg-muted transition-colors cursor-pointer">
                              <X className="size-4 text-muted-foreground" />
                            </button>
                          </div>

                          <div className="p-4 space-y-4">
                            {/* Title */}
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold">Title <span className="text-red-500">*</span></Label>
                              <Input
                                placeholder={`Enter ${cfg.label.toLowerCase()} title...`}
                                value={newItemTitle}
                                onChange={(e) => setNewItemTitle(e.target.value)}
                              />
                            </div>

                            {/* Description */}
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                              <Textarea
                                placeholder="Add a description or instructions..."
                                value={newItemDescription}
                                onChange={(e) => setNewItemDescription(e.target.value)}
                                rows={2}
                                className="resize-none"
                              />
                            </div>

                            {/* Required toggle */}
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id="new-item-required"
                                checked={newItemRequired}
                                onCheckedChange={(v) => setNewItemRequired(v as boolean)}
                              />
                              <Label htmlFor="new-item-required" className="text-sm cursor-pointer">Required</Label>
                            </div>

                            {/* ── Rich Content (tasks only) ── */}
                            {isTask && (
                              <div className="pt-3 border-t space-y-4">
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                  Rich Content <span className="font-normal normal-case tracking-normal">(all optional)</span>
                                </p>

                                {/* Video links */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                                      <Youtube className="size-3.5 text-red-500" />Video Links
                                    </Label>
                                    <Button type="button" variant="ghost" size="sm" onClick={addVideoLink} className="h-6 text-xs gap-1 px-2">
                                      <Plus className="size-3" />Add
                                    </Button>
                                  </div>
                                  {newItemVideoLinks.length === 0 && (
                                    <p className="text-[11px] text-muted-foreground">YouTube, Vimeo, or any video URL</p>
                                  )}
                                  {newItemVideoLinks.map((url, i) => (
                                    <div key={i} className="flex gap-2">
                                      <Input
                                        placeholder="https://youtube.com/watch?v=..."
                                        value={url}
                                        onChange={(e) => updateVideoLink(i, e.target.value)}
                                        className="text-xs h-8"
                                      />
                                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeVideoLink(i)}>
                                        <X className="size-3.5" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>

                                {/* Image URLs */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                                      <ImageIcon className="size-3.5 text-green-500" />Images
                                    </Label>
                                    <div className="flex items-center gap-1">
                                      <input
                                        ref={imageUploadInputRef}
                                        type="file"
                                        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                        className="hidden"
                                        onChange={(e) => handleTemplateImageUpload(e.target.files?.[0])}
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => imageUploadInputRef.current?.click()}
                                        disabled={uploadingTemplateImage}
                                        className="h-6 text-xs gap-1 px-2"
                                      >
                                        <Upload className="size-3" />
                                        {uploadingTemplateImage ? "Uploading" : "Upload"}
                                      </Button>
                                      <Button type="button" variant="ghost" size="sm" onClick={addImageUrl} className="h-6 text-xs gap-1 px-2">
                                        <Plus className="size-3" />URL
                                      </Button>
                                    </div>
                                  </div>
                                  {newItemImageUrls.length === 0 && (
                                    <p className="text-[11px] text-muted-foreground">Upload an image file or paste a publicly accessible image URL</p>
                                  )}
                                  {imageUploadError && (
                                    <p className="text-[11px] font-medium text-red-600">{imageUploadError}</p>
                                  )}
                                  {newItemImageUrls.map((url, i) => (
                                    <div key={i} className="flex gap-2 items-center">
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="size-8 shrink-0 overflow-hidden rounded-md border bg-white"
                                      >
                                        <img src={url} alt={`Image ${i + 1}`} className="h-full w-full object-cover" />
                                      </a>
                                      <Input
                                        placeholder="https://example.com/image.jpg"
                                        value={url}
                                        onChange={(e) => updateImageUrl(i, e.target.value)}
                                        className="text-xs h-8"
                                      />
                                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeImageUrl(i)}>
                                        <X className="size-3.5" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>

                                {/* File links */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                                      <Paperclip className="size-3.5 text-blue-500" />File References
                                    </Label>
                                    <Button type="button" variant="ghost" size="sm" onClick={addFileLink} className="h-6 text-xs gap-1 px-2">
                                      <Plus className="size-3" />Add
                                    </Button>
                                  </div>
                                  {newItemFileLinks.length === 0 && (
                                    <p className="text-[11px] text-muted-foreground">Google Drive, Dropbox, SharePoint, or any file link</p>
                                  )}
                                  {newItemFileLinks.map((file, i) => (
                                    <div key={i} className="flex gap-2">
                                      <Input
                                        placeholder="File name"
                                        value={file.name}
                                        onChange={(e) => updateFileLink(i, "name", e.target.value)}
                                        className="text-xs h-8 w-28 shrink-0"
                                      />
                                      <Input
                                        placeholder="https://drive.google.com/..."
                                        value={file.url}
                                        onChange={(e) => updateFileLink(i, "url", e.target.value)}
                                        className="text-xs h-8 flex-1"
                                      />
                                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeFileLink(i)}>
                                        <X className="size-3.5" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Form actions */}
                            <div className="flex gap-2 justify-end pt-1">
                              <Button variant="outline" size="sm" onClick={resetAddItemForm}>Cancel</Button>
                              <Button
                                size="sm"
                                onClick={() => handleAddTemplateItem(cat)}
                                disabled={savingNewItem || !newItemTitle.trim()}
                              >
                                <Save className="size-3 mr-1.5" />
                                {savingNewItem ? "Saving…" : `Save ${cfg.label}`}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            </div>
          )}

          <div className="px-6 py-4 border-t shrink-0 flex justify-end">
            <Button variant="outline" onClick={() => { setSelectedTemplate(null); resetAddItemForm(); }}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── New Template Dialog ── */}
      <Dialog open={showNewTemplateDialog} onOpenChange={setShowNewTemplateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Onboarding Template</DialogTitle>
            <DialogDescription>Set up a new template for employee onboarding</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Template Name</Label>
              <Input placeholder="e.g., Senior Developer Onboarding" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Department</Label>
              <Select value={newTemplateDepartment} onValueChange={setNewTemplateDepartment}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.department_id} value={dept.department_id}>{dept.department_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Position</Label>
              <Select value={newTemplatePosition} onValueChange={setNewTemplatePosition}>
                <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
                <SelectContent>
                  {positions
                    .filter((p) => !newTemplateDepartment || p.department_id === newTemplateDepartment)
                    .map((pos) => (
                      <SelectItem key={pos.position_id} value={pos.position_id}>{pos.position_name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Deadline (days)</Label>
              <Input type="number" placeholder="7" value={newTemplateDeadline} onChange={(e) => setNewTemplateDeadline(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowNewTemplateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateTemplate} disabled={creatingTemplate || !newTemplateName.trim() || !newTemplateDepartment || !newTemplatePosition}>
              <Save className="size-4 mr-2" />{creatingTemplate ? "Creating…" : "Create Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── New Position Dialog ── */}
      <Dialog open={showNewPositionDialog} onOpenChange={setShowNewPositionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Position</DialogTitle>
            <DialogDescription>Create a new position type in the system</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Position Title</Label>
              <Input placeholder="e.g., Lead Developer" value={newPositionTitle} onChange={(e) => setNewPositionTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Department</Label>
              <Select value={newPositionDepartment} onValueChange={setNewPositionDepartment}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.department_id} value={dept.department_id}>{dept.department_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowNewPositionDialog(false)}>Cancel</Button>
            <Button onClick={handleCreatePosition} disabled={!newPositionTitle.trim() || !newPositionDepartment}>
              <Plus className="size-4 mr-2" />Add Position
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
