"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  FileText,
  ChevronRight,
  FileCheck,
  ShieldCheck,
  Landmark,
  FilePen,
  AlertCircle,
  Clock,
  RotateCcw,
} from "lucide-react";
import {
  getPendingEmployeeDocuments,
  approveEmployeeDocument,
  rejectEmployeeDocument,
  type EmployeeDocument,
} from "@/lib/authApi";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type PendingDoc = EmployeeDocument & {
  user_profile: {
    first_name: string;
    last_name: string;
    employee_id: string;
    avatar_url?: string | null;
  };
};

type EmployeeDocGroup = {
  user_id: string;
  first_name: string;
  last_name: string;
  employee_id: string;
  avatar_url: string | null;
  docs: PendingDoc[];
  latest_upload: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const DOC_LABELS: Record<string, string> = {
  "government-id": "Government ID",
  "tax-form": "Tax Form",
  "employment-contract": "Employment Contract",
  "bank-details": "Bank Details / Payroll Form",
  resume: "Resume / CV",
};

function docLabel(type: string) {
  return DOC_LABELS[type] ?? type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function DocTypeIcon({ type }: { type: string }) {
  const cls = "h-4 w-4";
  if (type === "government-id") return <ShieldCheck className={cls} />;
  if (type === "bank-details") return <Landmark className={cls} />;
  if (type === "employment-contract") return <FilePen className={cls} />;
  if (type === "tax-form") return <FileCheck className={cls} />;
  return <FileText className={cls} />;
}

function employeeInitials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

function avatarColor(name: string) {
  let n = 0;
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function UserAvatar({
  firstName,
  lastName,
  avatarUrl,
  className,
  textClassName,
}: {
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  className: string;
  textClassName: string;
}) {
  const initials = employeeInitials(firstName, lastName);
  const colorCls = avatarColor(`${firstName}${lastName}`);
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div
      className={`${className} ${!avatarUrl || imageFailed ? `${colorCls} ${textClassName}` : "bg-slate-100"} overflow-hidden`}
    >
      {avatarUrl && !imageFailed ? (
        <img
          src={avatarUrl}
          alt={`${firstName} ${lastName}`.trim() || "Employee avatar"}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        initials
      )}
    </div>
  );
}

function groupByEmployee(docs: PendingDoc[]): EmployeeDocGroup[] {
  const map = new Map<string, EmployeeDocGroup>();
  for (const doc of docs) {
    const uid = doc.user_id;
    if (!map.has(uid)) {
      map.set(uid, {
        user_id: uid,
        first_name: doc.user_profile?.first_name ?? "",
        last_name: doc.user_profile?.last_name ?? "",
        employee_id: doc.user_profile?.employee_id ?? "",
        avatar_url: doc.user_profile?.avatar_url ?? null,
        docs: [],
        latest_upload: doc.uploaded_at,
      });
    }
    const group = map.get(uid)!;
    group.docs.push(doc);
    if (doc.uploaded_at > group.latest_upload) group.latest_upload = doc.uploaded_at;
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.latest_upload).getTime() - new Date(a.latest_upload).getTime()
  );
}

// ─── Employee Card ────────────────────────────────────────────────────────────

function EmployeeCard({
  group,
  onClick,
}: {
  group: EmployeeDocGroup;
  onClick: () => void;
}) {
  const fullName = `${group.first_name} ${group.last_name}`.trim();
  const replacementCount = group.docs.filter((doc) => doc.is_replacement_request).length;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all duration-150 p-5 flex items-center gap-4 group cursor-pointer"
    >
      <UserAvatar
        firstName={group.first_name}
        lastName={group.last_name}
        avatarUrl={group.avatar_url}
        className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
        textClassName="font-bold text-sm"
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground truncate">{fullName}</p>
        <p className="text-xs text-muted-foreground truncate">{group.employee_id}</p>
        <p className="text-xs text-muted-foreground/70 mt-0.5">
          Last submitted {formatDate(group.latest_upload)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border border-amber-200 font-semibold">
          {group.docs.length} pending
        </Badge>
        {replacementCount > 0 && (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border border-blue-200 font-semibold">
            {replacementCount} replacement
          </Badge>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
      </div>
    </button>
  );
}

// ─── Document Row (inside modal) ──────────────────────────────────────────────

type DocRowState = "idle" | "confirming-approve" | "rejecting" | "processing";

function DocumentRow({
  doc,
  onApproved,
  onRejected,
}: {
  doc: PendingDoc;
  onApproved: (id: string) => void;
  onRejected: (id: string) => void;
}) {
  const [state, setState] = useState<DocRowState>("idle");
  const [notes, setNotes] = useState("");
  const isReplacementRequest = doc.is_replacement_request === true;
  const itemLabel = isReplacementRequest
    ? `${docLabel(doc.document_type)} replacement request`
    : docLabel(doc.document_type);

  const handleApprove = async () => {
    setState("processing");
    try {
      await approveEmployeeDocument(doc.id);
      toast.success(`${itemLabel} approved.`);
      onApproved(doc.id);
    } catch (e: any) {
      toast.error(e?.message ?? "Approval failed.");
      setState("idle");
    }
  };

  const handleReject = async () => {
    if (!notes.trim()) {
      toast.error("Please provide a rejection reason.");
      return;
    }
    setState("processing");
    try {
      await rejectEmployeeDocument(doc.id, notes.trim());
      toast.success(`${itemLabel} rejected.`);
      onRejected(doc.id);
    } catch (e: any) {
      toast.error(e?.message ?? "Rejection failed.");
      setState("idle");
    }
  };

  const busy = state === "processing";

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
      {/* Doc header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-background border border-border flex items-center justify-center text-muted-foreground shrink-0">
            <DocTypeIcon type={doc.document_type} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{docLabel(doc.document_type)}</p>
              {isReplacementRequest && (
                <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 border border-blue-200 text-[10px]">
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Replacement Request
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {doc.file_name}
              {doc.file_size ? ` · ${formatBytes(doc.file_size)}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(doc.uploaded_at)}
          </span>
          {doc.file_url && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 px-2" asChild>
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
                View
              </a>
            </Button>
          )}
        </div>
      </div>

      {isReplacementRequest && doc.replacement_reason && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">
            Replacement Reason
          </p>
          <p className="text-xs text-blue-900 mt-1">{doc.replacement_reason}</p>
        </div>
      )}

      {/* Confirm approve prompt */}
      {state === "confirming-approve" && (
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2.5">
          <p className="text-xs text-emerald-800 font-medium">
            Approve <span className="font-semibold">{docLabel(doc.document_type)}</span>? The employee will be notified.
          </p>
        </div>
      )}

      {/* Rejection notes input */}
      {state === "rejecting" && (
        <Textarea
          placeholder="Reason for rejection — the employee will see this (required)…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="text-sm resize-none"
          autoFocus
        />
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {state === "idle" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 hover:text-emerald-700 text-xs"
              onClick={() => setState("confirming-approve")}
              disabled={busy}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300 hover:text-rose-700 text-xs"
              onClick={() => setState("rejecting")}
              disabled={busy}
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </Button>
          </>
        )}

        {state === "confirming-approve" && (
          <>
            <Button
              size="sm"
              className="h-8 gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs"
              onClick={handleApprove}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Confirm Approval
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => setState("idle")}
              disabled={busy}
            >
              Cancel
            </Button>
          </>
        )}

        {state === "rejecting" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 border-rose-300 bg-rose-700 text-white hover:bg-rose-800 text-xs"
              onClick={handleReject}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5" />
              )}
              Confirm Reject
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => { setState("idle"); setNotes(""); }}
              disabled={busy}
            >
              Cancel
            </Button>
          </>
        )}

        {state === "processing" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Processing…
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Employee Detail Dialog ───────────────────────────────────────────────────

function EmployeeDocDetailDialog({
  group,
  open,
  onClose,
  onGroupEmpty,
}: {
  group: EmployeeDocGroup | null;
  open: boolean;
  onClose: () => void;
  onGroupEmpty: (userId: string) => void;
}) {
  const [remaining, setRemaining] = useState<PendingDoc[]>([]);
  // Tracks whether at least one doc has been reviewed in this session.
  // Guards against calling onGroupEmpty on initial mount when remaining=[].
  const [hadDocs, setHadDocs] = useState(false);

  useEffect(() => {
    if (group) {
      setRemaining([...group.docs]);
      setHadDocs(false);
    }
  }, [group]);

  // Call parent callbacks AFTER render, not inside a setState updater
  useEffect(() => {
    if (hadDocs && remaining.length === 0 && group) {
      onGroupEmpty(group.user_id);
      onClose();
    }
  }, [hadDocs, remaining.length, group, onGroupEmpty, onClose]);

  const removeDoc = useCallback((docId: string) => {
    setHadDocs(true);
    setRemaining((prev) => prev.filter((d) => d.id !== docId));
  }, []);

  if (!group) return null;

  const fullName = `${group.first_name} ${group.last_name}`.trim();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg w-full max-h-[90vh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden">
        <DialogHeader className="px-6 py-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <UserAvatar
              firstName={group.first_name}
              lastName={group.last_name}
              avatarUrl={group.avatar_url}
              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              textClassName="font-bold text-sm"
            />
            <div>
              <DialogTitle className="text-base font-semibold text-foreground leading-tight">
                {fullName}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{group.employee_id}</p>
            </div>
            {remaining.length > 0 && (
              <Badge className="ml-auto bg-amber-100 text-amber-700 hover:bg-amber-100 border border-amber-200 font-semibold shrink-0">
                {remaining.length} pending
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {remaining.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-foreground">All documents reviewed</p>
              <p className="text-xs text-muted-foreground">The employee will be notified of your decisions.</p>
            </div>
          ) : (
            remaining.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                onApproved={removeDoc}
                onRejected={removeDoc}
              />
            ))
          )}
        </div>

        {remaining.length > 0 && (
          <div className="px-6 py-3 border-t border-border shrink-0 bg-muted/10">
            <p className="text-[11px] text-muted-foreground">
              Rejected documents allow the employee to resubmit a corrected version.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HRDocumentApprovalsView() {
  const [groups, setGroups] = useState<EmployeeDocGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EmployeeDocGroup | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getPendingEmployeeDocuments()
      .then((docs) => setGroups(groupByEmployee(docs as PendingDoc[])))
      .catch(() => toast.error("Failed to load pending documents."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEmployee = (group: EmployeeDocGroup) => {
    setSelected(group);
    setDialogOpen(true);
  };

  const handleGroupEmpty = useCallback((userId: string) => {
    setGroups((prev) => prev.filter((g) => g.user_id !== userId));
  }, []);

  const totalPending = groups.reduce((acc, g) => acc + g.docs.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading
            ? "Loading…"
            : groups.length === 0
            ? "No pending documents"
            : `${groups.length} employee${groups.length !== 1 ? "s" : ""} · ${totalPending} document${totalPending !== 1 ? "s" : ""} pending review`}
        </p>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading documents…</span>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center rounded-2xl border border-dashed border-border bg-muted/20">
          <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center">
            <FileCheck className="h-7 w-7 text-emerald-600" />
          </div>
          <p className="text-base font-semibold text-foreground">All caught up</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            No employee documents are waiting for review.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {groups.map((group) => (
            <EmployeeCard
              key={group.user_id}
              group={group}
              onClick={() => openEmployee(group)}
            />
          ))}
        </div>
      )}

      <EmployeeDocDetailDialog
        group={selected}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onGroupEmpty={handleGroupEmpty}
      />
    </div>
  );
}
