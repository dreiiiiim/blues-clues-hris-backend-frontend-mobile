import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { Sidebar } from "../components/Sidebar";
import { BottomTabBar, BOTTOM_TAB_HEIGHT } from "../components/BottomTabBar";
import { GradientHero } from "../components/GradientHero";
import { authFetch, type UserSession } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type EmployeeDocument = {
  id: string;
  document_type: string;
  file_name?: string | null;
  file_url?: string | null;
  status: string;
  uploaded_at?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
};

type DocConfig = {
  id: string;
  title: string;
  description: string;
  accepted: string;
  icon: keyof typeof Ionicons.glyphMap;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const REQUIRED_DOCS: DocConfig[] = [
  { id: "government-id",        title: "Government ID",                description: "Upload a valid government-issued identification card.", accepted: ".pdf,.png,.jpg,.jpeg",               icon: "shield-checkmark-outline" },
  { id: "tax-form",             title: "Tax Form",                     description: "Submit your required tax-related onboarding document.",  accepted: ".pdf,.png,.jpg,.jpeg,.doc,.docx",    icon: "document-text-outline"    },
  { id: "employment-contract",  title: "Signed Employment Contract",   description: "Upload your signed employment contract.",                accepted: ".pdf,.doc,.docx",                    icon: "checkmark-done-outline"   },
  { id: "bank-details",         title: "Bank Details / Payroll Form",  description: "Provide your payroll-related bank document or form.",    accepted: ".pdf,.png,.jpg,.jpeg,.doc,.docx",    icon: "business-outline"         },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusTone(status: string): { bg: string; border: string; text: string } {
  if (status === "approved")  return { bg: "#F0FDF4", border: "#BBF7D0", text: "#15803D" };
  if (status === "pending")   return { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" };
  if (status === "rejected")  return { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C" };
  return { bg: "#F1F5F9", border: "#E2E8F0", text: "#64748B" };
}

function statusLabel(status: string): string {
  if (status === "approved") return "Approved";
  if (status === "pending")  return "Pending HR Review";
  if (status === "rejected") return "Rejected";
  return status;
}

// ─── Replace Request Modal ────────────────────────────────────────────────────

function ReplaceModal({
  docTitle,
  onClose,
  onSubmitted,
}: {
  docTitle: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  // We store the docId passed via closure
  const [file, setFile] = useState<{ uri: string; name: string; mimeType?: string } | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setFile({ uri: a.uri, name: a.name, mimeType: a.mimeType });
    }
  }

  async function handleSubmit(docDbId: string) {
    if (!file) { Alert.alert("Validation", "Please select a file."); return; }
    if (reason.trim().length < 10) { Alert.alert("Validation", "Reason must be at least 10 characters."); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("file", { uri: file.uri, name: file.name, type: file.mimeType ?? "application/octet-stream" } as any);
      fd.append("reason", reason.trim());
      const res = await authFetch(`${API_BASE_URL}/users/documents/${docDbId}/replace-request`, { method: "PATCH", body: fd });
      if (!res.ok) throw new Error();
      Alert.alert("Success", "Replacement request submitted — awaiting HR review.");
      onSubmitted();
    } catch {
      Alert.alert("Error", "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide">
      <Pressable style={m.overlay} onPress={onClose}>
        <Pressable style={m.sheet} onPress={e => e.stopPropagation?.()}>
          <View style={m.sheetHeader}>
            <View>
              <Text style={m.sheetTitle}>Replace Document</Text>
              <Text style={m.sheetSub}>{docTitle}</Text>
            </View>
            <Pressable onPress={onClose}><Ionicons name="close" size={20} color="#64748B" /></Pressable>
          </View>

          <Text style={m.fieldLabel}>New Document *</Text>
          {file ? (
            <View style={m.fileRow}>
              <Ionicons name="document-text-outline" size={18} color="#64748B" />
              <Text style={m.fileName} numberOfLines={1}>{file.name}</Text>
              <Pressable onPress={() => setFile(null)}><Ionicons name="close-circle" size={16} color="#94A3B8" /></Pressable>
            </View>
          ) : (
            <Pressable style={m.uploadBox} onPress={pickFile}>
              <Ionicons name="cloud-upload-outline" size={22} color="#94A3B8" />
              <Text style={m.uploadText}>Tap to select a file</Text>
            </Pressable>
          )}

          <Text style={m.fieldLabel}>Reason for replacement * (min 10 chars)</Text>
          <TextInput
            style={[m.input, m.inputMulti]}
            value={reason}
            onChangeText={setReason}
            placeholder="Explain why you are replacing this document…"
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
          />
          <Text style={m.charCount}>{reason.length} / 500</Text>

          <View style={m.footerRow}>
            <Pressable style={[m.btn, m.btnOutline]} onPress={onClose} disabled={submitting}>
              <Text style={m.btnOutlineText}>Cancel</Text>
            </Pressable>
            <Pressable style={[m.btn, m.btnPrimary]} onPress={() => { /* will be called with docDbId from parent */ }} disabled={submitting || !file || reason.trim().length < 10}>
              {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={m.btnPrimaryText}>Submit for HR Review</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Document Card ────────────────────────────────────────────────────────────

function DocCard({
  config,
  doc,
  onUpload,
  onDelete,
  onReplace,
  uploading,
  deleting,
}: {
  config: DocConfig;
  doc?: EmployeeDocument;
  onUpload: (docId: string) => void;
  onDelete: (doc: EmployeeDocument) => void;
  onReplace: (doc: EmployeeDocument) => void;
  uploading: boolean;
  deleting: boolean;
}) {
  const tone = doc ? statusTone(doc.status) : statusTone("none");
  return (
    <View style={c.card}>
      <View style={c.cardTop}>
        <View style={c.iconWrap}>
          <Ionicons name={config.icon} size={22} color="#1E40AF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={c.docTitle}>{config.title}</Text>
          <Text style={c.docDesc}>{config.description}</Text>
        </View>
        {doc && (
          <View style={[c.statusPill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
            <Text style={[c.statusText, { color: tone.text }]}>{statusLabel(doc.status)}</Text>
          </View>
        )}
      </View>

      {!!doc?.rejection_reason && (
        <View style={c.rejectBox}>
          <Text style={c.rejectText}>Rejection reason: {doc.rejection_reason}</Text>
        </View>
      )}

      {!!doc?.file_name && (
        <View style={c.fileInfoRow}>
          <Ionicons name="document-outline" size={14} color="#64748B" />
          <Text style={c.fileInfoText} numberOfLines={1}>{doc.file_name}</Text>
          {!!doc.uploaded_at && <Text style={c.fileDate}>{new Date(doc.uploaded_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</Text>}
        </View>
      )}

      <View style={c.actionRow}>
        {!doc ? (
          <Pressable style={c.uploadBtn} onPress={() => onUpload(config.id)} disabled={uploading}>
            {uploading ? <ActivityIndicator size="small" color="#fff" /> : (
              <>
                <Ionicons name="cloud-upload-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={c.uploadBtnText}>Upload</Text>
              </>
            )}
          </Pressable>
        ) : doc.status === "approved" ? (
          <Pressable style={[c.actionBtn, c.replaceBtn]} onPress={() => onReplace(doc)}>
            <Ionicons name="swap-horizontal-outline" size={14} color="#1E40AF" style={{ marginRight: 4 }} />
            <Text style={c.replaceBtnText}>Replace</Text>
          </Pressable>
        ) : doc.status === "rejected" ? (
          <Pressable style={c.uploadBtn} onPress={() => onUpload(config.id)} disabled={uploading}>
            {uploading ? <ActivityIndicator size="small" color="#fff" /> : (
              <>
                <Ionicons name="reload-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={c.uploadBtnText}>Re-upload</Text>
              </>
            )}
          </Pressable>
        ) : null}

        {doc && doc.status !== "approved" && (
          <Pressable style={[c.actionBtn, c.deleteBtn]} onPress={() => onDelete(doc)} disabled={deleting}>
            {deleting ? <ActivityIndicator size="small" color="#B91C1C" /> : <Ionicons name="trash-outline" size={15} color="#B91C1C" />}
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function EmployeeDocumentsScreen({ route, navigation }: any) {
  const session: UserSession = route.params?.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  const [replaceTarget, setReplaceTarget] = useState<{ doc: EmployeeDocument; config: DocConfig } | null>(null);
  const [replaceFile, setReplaceFile] = useState<{ uri: string; name: string; mimeType?: string } | null>(null);
  const [replaceReason, setReplaceReason] = useState("");
  const [replaceSubmitting, setReplaceSubmitting] = useState(false);

  function load(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    authFetch(`${API_BASE_URL}/users/me/documents`)
      .then(r => r.json())
      .then((data: EmployeeDocument[]) => setDocs(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }

  useEffect(() => { load(); }, []);

  async function handleUpload(docTypeId: string) {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    setUploading(prev => ({ ...prev, [docTypeId]: true }));
    try {
      const fd = new FormData();
      fd.append("file", { uri: asset.uri, name: asset.name, type: asset.mimeType ?? "application/octet-stream" } as any);
      fd.append("document_type", docTypeId);
      const res = await authFetch(`${API_BASE_URL}/users/me/documents`, { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      load();
      Alert.alert("Uploaded", "Document uploaded. Awaiting HR review.");
    } catch {
      Alert.alert("Error", "Upload failed.");
    } finally {
      setUploading(prev => ({ ...prev, [docTypeId]: false }));
    }
  }

  async function handleDelete(doc: EmployeeDocument) {
    Alert.alert("Delete Document", "Are you sure you want to remove this document?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          setDeleting(prev => ({ ...prev, [doc.id]: true }));
          try {
            await authFetch(`${API_BASE_URL}/users/me/documents/${doc.id}`, { method: "DELETE" });
            setDocs(prev => prev.filter(d => d.id !== doc.id));
          } catch {
            Alert.alert("Error", "Delete failed.");
          } finally {
            setDeleting(prev => ({ ...prev, [doc.id]: false }));
          }
        },
      },
    ]);
  }

  async function submitReplace() {
    if (!replaceTarget || !replaceFile) return;
    if (replaceReason.trim().length < 10) { Alert.alert("Validation", "Reason must be at least 10 characters."); return; }
    setReplaceSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("file", { uri: replaceFile.uri, name: replaceFile.name, type: replaceFile.mimeType ?? "application/octet-stream" } as any);
      fd.append("reason", replaceReason.trim());
      const res = await authFetch(`${API_BASE_URL}/users/documents/${replaceTarget.doc.id}/replace-request`, { method: "PATCH", body: fd });
      if (!res.ok) throw new Error();
      Alert.alert("Submitted", "Replacement request submitted — awaiting HR review.");
      setReplaceTarget(null);
      setReplaceFile(null);
      setReplaceReason("");
      load();
    } catch {
      Alert.alert("Error", "Submission failed.");
    } finally {
      setReplaceSubmitting(false);
    }
  }

  const approvedCount = docs.filter(d => d.status === "approved").length;
  const pendingCount = docs.filter(d => d.status === "pending").length;

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}><ActivityIndicator size="large" color="#1E40AF" /><Text style={s.loadingText}>Loading documents...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        {!isMobile && (
          <Sidebar role="employee" userName={session?.name ?? ""} email={session?.email ?? ""} activeScreen="Documents" navigation={navigation} />
        )}

        <View style={s.main}>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={[s.scrollContent, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load(true)}
                colors={["#1E40AF"]}
                tintColor="#1E40AF"
              />
            }
          >
            <GradientHero>
              <Text style={s.heroEyebrow}>Employee Self-Service</Text>
              <Text style={s.heroTitle}>My Documents</Text>
              <Text style={s.heroSub}>Upload and manage your required employment documents.</Text>
              <View style={s.heroStats}>
                <View style={s.heroStatBox}><Text style={s.heroStatLabel}>APPROVED</Text><Text style={s.heroStatValue}>{approvedCount}</Text></View>
                <View style={s.heroStatBox}><Text style={s.heroStatLabel}>PENDING</Text><Text style={s.heroStatValue}>{pendingCount}</Text></View>
                <View style={s.heroStatBox}><Text style={s.heroStatLabel}>TOTAL</Text><Text style={s.heroStatValue}>{REQUIRED_DOCS.length}</Text></View>
              </View>
            </GradientHero>

            {REQUIRED_DOCS.map(config => {
              const doc = docs.find(d => d.document_type === config.id);
              return (
                <DocCard
                  key={config.id}
                  config={config}
                  doc={doc}
                  onUpload={handleUpload}
                  onDelete={handleDelete}
                  onReplace={(d) => setReplaceTarget({ doc: d, config })}
                  uploading={!!uploading[config.id]}
                  deleting={!!deleting[doc?.id ?? ""]}
                />
              );
            })}
          </ScrollView>

          {isMobile && (
            <BottomTabBar role="employee" activeScreen="Documents" navigation={navigation} session={session} />
          )}
        </View>
      </View>

      {/* Replace Modal */}
      {replaceTarget && (
        <Modal visible transparent animationType="slide">
          <Pressable style={m.overlay} onPress={() => setReplaceTarget(null)}>
            <Pressable style={m.sheet}>
              <View style={m.sheetHeader}>
                <View>
                  <Text style={m.sheetTitle}>Replace Document</Text>
                  <Text style={m.sheetSub}>{replaceTarget.config.title}</Text>
                </View>
                <Pressable onPress={() => setReplaceTarget(null)}><Ionicons name="close" size={20} color="#64748B" /></Pressable>
              </View>

              <Text style={m.fieldLabel}>New Document *</Text>
              {replaceFile ? (
                <View style={m.fileRow}>
                  <Ionicons name="document-text-outline" size={18} color="#64748B" />
                  <Text style={m.fileName} numberOfLines={1}>{replaceFile.name}</Text>
                  <Pressable onPress={() => setReplaceFile(null)}><Ionicons name="close-circle" size={16} color="#94A3B8" /></Pressable>
                </View>
              ) : (
                <Pressable style={m.uploadBox} onPress={async () => {
                  const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
                  if (!r.canceled && r.assets[0]) setReplaceFile({ uri: r.assets[0].uri, name: r.assets[0].name, mimeType: r.assets[0].mimeType });
                }}>
                  <Ionicons name="cloud-upload-outline" size={22} color="#94A3B8" />
                  <Text style={m.uploadText}>Tap to select a file</Text>
                </Pressable>
              )}

              <Text style={m.fieldLabel}>Reason for replacement * (min 10 chars)</Text>
              <TextInput
                style={[m.input, m.inputMulti]}
                value={replaceReason}
                onChangeText={setReplaceReason}
                placeholder="Explain why you are replacing this document…"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />
              <Text style={m.charCount}>{replaceReason.length} / 500</Text>

              <View style={m.footerRow}>
                <Pressable style={[m.btn, m.btnOutline]} onPress={() => setReplaceTarget(null)} disabled={replaceSubmitting}>
                  <Text style={m.btnOutlineText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[m.btn, m.btnPrimary, (!replaceFile || replaceReason.trim().length < 10) && m.btnDisabled]}
                  onPress={submitReplace}
                  disabled={replaceSubmitting || !replaceFile || replaceReason.trim().length < 10}
                >
                  {replaceSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={m.btnPrimaryText}>Submit for HR Review</Text>}
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  inner: { flex: 1, flexDirection: "row" },
  main: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, color: "#64748B", fontSize: 14 },
  heroEyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1.8, color: "rgba(255,255,255,0.6)", marginBottom: 4, textTransform: "uppercase" },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", marginBottom: 4 },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginBottom: 12 },
  heroStats: { flexDirection: "row", gap: 16, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 12 },
  heroStatBox: { flex: 1, alignItems: "center" },
  heroStatLabel: { fontSize: 8, fontWeight: "700", color: "rgba(255,255,255,0.6)", letterSpacing: 1.5, textTransform: "uppercase" },
  heroStatValue: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", marginTop: 4 },
});

const c = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  docTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A", flex: 1 },
  docDesc: { fontSize: 12, color: "#64748B", marginTop: 2, lineHeight: 17 },
  statusPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, marginLeft: 4 },
  statusText: { fontSize: 10, fontWeight: "700" },
  rejectBox: { backgroundColor: "#FEF2F2", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#FECACA" },
  rejectText: { fontSize: 12, color: "#B91C1C" },
  fileInfoRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 4 },
  fileInfoText: { fontSize: 12, color: "#64748B", flex: 1 },
  fileDate: { fontSize: 11, color: "#94A3B8" },
  actionRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  uploadBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E40AF", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  uploadBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  actionBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, flexDirection: "row", alignItems: "center" },
  replaceBtn: { backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE" },
  replaceBtnText: { color: "#1E40AF", fontSize: 13, fontWeight: "600" },
  deleteBtn: { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 10 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  sheetSub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 1 },
  uploadBox: { borderWidth: 2, borderStyle: "dashed", borderColor: "#CBD5E1", borderRadius: 10, padding: 20, alignItems: "center", gap: 6 },
  uploadText: { fontSize: 13, color: "#94A3B8" },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F8FAFC", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  fileName: { flex: 1, fontSize: 13, color: "#0F172A" },
  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14, color: "#0F172A" },
  inputMulti: { minHeight: 72, textAlignVertical: "top" },
  charCount: { fontSize: 10, color: "#94A3B8", textAlign: "right" },
  footerRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  btn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 10, paddingVertical: 11 },
  btnPrimary: { backgroundColor: "#1E40AF" },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  btnOutline: { borderWidth: 1, borderColor: "#CBD5E1" },
  btnOutlineText: { color: "#475569", fontWeight: "600", fontSize: 14 },
  btnDisabled: { opacity: 0.4 },
});
