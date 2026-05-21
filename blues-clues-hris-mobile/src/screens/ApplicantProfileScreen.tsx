import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
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

type ApplicantProfile = {
  applicant_id: string;
  email: string;
  applicant_code: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  personal_email: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  nationality: string | null;
  civil_status: string | null;
  complete_address: string | null;
  resume_url: string | null;
  resume_name: string | null;
  resume_uploaded_at: string | null;
  sfia_grade: string | null;
  sfia_match_percentage: number | null;
};

type PersonalDraft = { first_name: string; middle_name: string; last_name: string };
type ContactDraft = {
  phone_number: string;
  personal_email: string;
  date_of_birth: string;
  place_of_birth: string;
  nationality: string;
  civil_status: string;
  complete_address: string;
};

const CIVIL_STATUS_OPTIONS = ["Single", "Married", "Widowed", "Separated"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function textOrDash(val: string | null | undefined): string {
  return val?.trim() || "—";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, editing, saving, onEdit, onSave, onCancel }: {
  title: string;
  editing: boolean;
  saving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {editing ? (
        <View style={styles.btnRow}>
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={onSave} disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.btnPrimaryText}>Save</Text>}
          </Pressable>
          <Pressable style={[styles.btn, styles.btnOutline]} onPress={onCancel} disabled={saving}>
            <Text style={styles.btnOutlineText}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={[styles.btn, styles.btnOutline]} onPress={onEdit}>
          <Ionicons name="pencil-outline" size={13} color="#475569" style={{ marginRight: 4 }} />
          <Text style={styles.btnOutlineText}>Edit</Text>
        </Pressable>
      )}
    </View>
  );
}

function FieldLabel({ label, badge }: { label: string; badge: "self" | "system" }) {
  return (
    <View style={styles.fieldLabelRow}>
      <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
      <View style={badge === "self" ? styles.badgeSelf : styles.badgeSystem}>
        <Text style={badge === "self" ? styles.badgeSelfText : styles.badgeSystemText}>
          {badge === "self" ? "Self-service" : "System-managed"}
        </Text>
      </View>
    </View>
  );
}

function ReadField({ value }: { value: string }) {
  return (
    <View style={styles.readField}>
      <Text style={styles.readFieldText}>{value}</Text>
    </View>
  );
}

function EditField({ value, onChange, placeholder, multiline }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <TextInput
      style={[styles.input, multiline && styles.inputMulti]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#94A3B8"
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
    />
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function ApplicantProfileScreen({ route, navigation }: any) {
  const session: UserSession = route.params?.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [profile, setProfile] = useState<ApplicantProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Personal
  const [personalDraft, setPersonalDraft] = useState<PersonalDraft>({ first_name: "", middle_name: "", last_name: "" });
  const [personalEditing, setPersonalEditing] = useState(false);
  const [personalSaving, setPersonalSaving] = useState(false);

  // Contact
  const [contactDraft, setContactDraft] = useState<ContactDraft>({
    phone_number: "", personal_email: "", date_of_birth: "", place_of_birth: "",
    nationality: "", civil_status: "", complete_address: "",
  });
  const [contactEditing, setContactEditing] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [civilModal, setCivilModal] = useState(false);

  // Resume
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [resumeName, setResumeName] = useState<string | null>(null);
  const [resumeUploadedAt, setResumeUploadedAt] = useState<string | null>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeDeleting, setResumeDeleting] = useState(false);

  useEffect(() => {
    authFetch(`${API_BASE_URL}/applicants/me`)
      .then(r => r.json())
      .then((p: ApplicantProfile) => {
        setProfile(p);
        setPersonalDraft({ first_name: p.first_name ?? "", middle_name: p.middle_name ?? "", last_name: p.last_name ?? "" });
        setContactDraft({
          phone_number: p.phone_number ?? "",
          personal_email: p.personal_email ?? "",
          date_of_birth: p.date_of_birth ?? "",
          place_of_birth: p.place_of_birth ?? "",
          nationality: p.nationality ?? "",
          civil_status: p.civil_status ?? "",
          complete_address: p.complete_address ?? "",
        });
        setResumeUrl(p.resume_url ?? null);
        setResumeName(p.resume_name ?? null);
        setResumeUploadedAt(p.resume_uploaded_at ?? null);
      })
      .catch(() => Alert.alert("Error", "Failed to load profile."))
      .finally(() => setLoading(false));
  }, []);

  async function savePersonal() {
    if (!personalDraft.first_name.trim()) { Alert.alert("Validation", "First name is required."); return; }
    setPersonalSaving(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/applicants/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: personalDraft.first_name.trim(),
          middle_name: personalDraft.middle_name.trim() || null,
          last_name: personalDraft.last_name.trim(),
        }),
      });
      const updated: ApplicantProfile = await res.json();
      setProfile(updated);
      setPersonalEditing(false);
    } catch {
      Alert.alert("Error", "Save failed.");
    } finally {
      setPersonalSaving(false);
    }
  }

  function cancelPersonal() {
    setPersonalDraft({ first_name: profile?.first_name ?? "", middle_name: profile?.middle_name ?? "", last_name: profile?.last_name ?? "" });
    setPersonalEditing(false);
  }

  async function saveContact() {
    setContactSaving(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/applicants/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: contactDraft.phone_number.trim() || null,
          personal_email: contactDraft.personal_email.trim() || null,
          date_of_birth: contactDraft.date_of_birth || null,
          place_of_birth: contactDraft.place_of_birth.trim() || null,
          nationality: contactDraft.nationality.trim() || null,
          civil_status: contactDraft.civil_status || null,
          complete_address: contactDraft.complete_address.trim() || null,
        }),
      });
      const updated: ApplicantProfile = await res.json();
      setProfile(updated);
      setContactEditing(false);
    } catch {
      Alert.alert("Error", "Save failed.");
    } finally {
      setContactSaving(false);
    }
  }

  function cancelContact() {
    if (profile) {
      setContactDraft({
        phone_number: profile.phone_number ?? "",
        personal_email: profile.personal_email ?? "",
        date_of_birth: profile.date_of_birth ?? "",
        place_of_birth: profile.place_of_birth ?? "",
        nationality: profile.nationality ?? "",
        civil_status: profile.civil_status ?? "",
        complete_address: profile.complete_address ?? "",
      });
    }
    setContactEditing(false);
  }

  async function pickAndUploadResume() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;

      setResumeUploading(true);
      const fd = new FormData();
      fd.append("file", { uri: asset.uri, name: asset.name, type: asset.mimeType ?? "application/octet-stream" } as any);
      const res = await authFetch(`${API_BASE_URL}/applicants/me/resume`, { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const data: { resume_url: string; resume_name: string; resume_uploaded_at: string } = await res.json();
      setResumeUrl(data.resume_url);
      setResumeName(data.resume_name);
      setResumeUploadedAt(data.resume_uploaded_at);
    } catch {
      Alert.alert("Error", "Resume upload failed.");
    } finally {
      setResumeUploading(false);
    }
  }

  async function deleteResume() {
    Alert.alert("Remove Resume", "Are you sure you want to remove your resume?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive", onPress: async () => {
          setResumeDeleting(true);
          try {
            await authFetch(`${API_BASE_URL}/applicants/me/resume`, { method: "DELETE" });
            setResumeUrl(null);
            setResumeName(null);
            setResumeUploadedAt(null);
          } catch {
            Alert.alert("Error", "Failed to remove resume.");
          } finally {
            setResumeDeleting(false);
          }
        },
      },
    ]);
  }

  const displayName = [personalDraft.first_name, personalDraft.middle_name, personalDraft.last_name].filter(Boolean).join(" ") || session?.name || "Applicant";
  const initials = displayName.charAt(0).toUpperCase();
  const sfiaGrade = profile?.sfia_grade ?? null;
  const sfiaMatch = profile?.sfia_match_percentage ?? null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1E40AF" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {!isMobile && (
          <Sidebar role="applicant" userName={session?.name ?? ""} email={session?.email ?? ""} activeScreen="Profile" navigation={navigation} />
        )}

        <View style={styles.main}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero */}
            <GradientHero style={styles.hero}>
              <Text style={styles.heroEyebrow}>Candidate Portal</Text>
              <Text style={styles.heroTitle}>My Profile</Text>
              <Text style={styles.heroSubtitle}>
                Keep your profile up to date so employers can reach you with the right opportunities.
              </Text>
            </GradientHero>

            {/* Avatar card */}
            <View style={styles.avatarCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.avatarName}>{displayName}</Text>
                <View style={styles.rolePill}><Text style={styles.rolePillText}>Applicant</Text></View>
              </View>
            </View>

            {/* ── Personal Information ────────────────────────────────────── */}
            <View style={styles.card}>
              <SectionHeader
                title="Personal Information"
                editing={personalEditing}
                saving={personalSaving}
                onEdit={() => setPersonalEditing(true)}
                onSave={savePersonal}
                onCancel={cancelPersonal}
              />

              <View style={styles.fieldGrid}>
                <View style={styles.fieldCell}>
                  <FieldLabel label="First Name" badge="self" />
                  {personalEditing
                    ? <EditField value={personalDraft.first_name} onChange={v => setPersonalDraft(d => ({ ...d, first_name: v }))} placeholder="First name" />
                    : <ReadField value={textOrDash(personalDraft.first_name)} />}
                </View>
                <View style={styles.fieldCell}>
                  <FieldLabel label="Middle Name" badge="self" />
                  {personalEditing
                    ? <EditField value={personalDraft.middle_name} onChange={v => setPersonalDraft(d => ({ ...d, middle_name: v }))} placeholder="Middle name" />
                    : <ReadField value={textOrDash(personalDraft.middle_name)} />}
                </View>
                <View style={styles.fieldCell}>
                  <FieldLabel label="Last Name" badge="self" />
                  {personalEditing
                    ? <EditField value={personalDraft.last_name} onChange={v => setPersonalDraft(d => ({ ...d, last_name: v }))} placeholder="Last name" />
                    : <ReadField value={textOrDash(personalDraft.last_name)} />}
                </View>
                <View style={styles.fieldCell}>
                  <FieldLabel label="Work Email" badge="system" />
                  <ReadField value={session?.email ?? profile?.email ?? "—"} />
                </View>
              </View>
            </View>

            {/* ── Contact & Address ───────────────────────────────────────── */}
            <View style={styles.card}>
              <SectionHeader
                title="Contact & Address"
                editing={contactEditing}
                saving={contactSaving}
                onEdit={() => setContactEditing(true)}
                onSave={saveContact}
                onCancel={cancelContact}
              />

              <View style={styles.fieldGrid}>
                <View style={styles.fieldCell}>
                  <FieldLabel label="Phone Number" badge="self" />
                  {contactEditing
                    ? <EditField value={contactDraft.phone_number} onChange={v => setContactDraft(d => ({ ...d, phone_number: v }))} placeholder="+63 900 000 0000" />
                    : <ReadField value={textOrDash(contactDraft.phone_number)} />}
                </View>
                <View style={styles.fieldCell}>
                  <FieldLabel label="Personal Email" badge="self" />
                  {contactEditing
                    ? <EditField value={contactDraft.personal_email} onChange={v => setContactDraft(d => ({ ...d, personal_email: v }))} placeholder="personal@email.com" />
                    : <ReadField value={textOrDash(contactDraft.personal_email)} />}
                </View>
                <View style={styles.fieldCell}>
                  <FieldLabel label="Date of Birth" badge="self" />
                  {contactEditing
                    ? <EditField value={contactDraft.date_of_birth} onChange={v => setContactDraft(d => ({ ...d, date_of_birth: v }))} placeholder="YYYY-MM-DD" />
                    : <ReadField value={contactDraft.date_of_birth ? formatDate(contactDraft.date_of_birth) : "—"} />}
                </View>
                <View style={styles.fieldCell}>
                  <FieldLabel label="Place of Birth" badge="self" />
                  {contactEditing
                    ? <EditField value={contactDraft.place_of_birth} onChange={v => setContactDraft(d => ({ ...d, place_of_birth: v }))} placeholder="City, Province" />
                    : <ReadField value={textOrDash(contactDraft.place_of_birth)} />}
                </View>
                <View style={styles.fieldCell}>
                  <FieldLabel label="Nationality" badge="self" />
                  {contactEditing
                    ? <EditField value={contactDraft.nationality} onChange={v => setContactDraft(d => ({ ...d, nationality: v }))} placeholder="e.g. Filipino" />
                    : <ReadField value={textOrDash(contactDraft.nationality)} />}
                </View>
                <View style={styles.fieldCell}>
                  <FieldLabel label="Civil Status" badge="self" />
                  {contactEditing ? (
                    <Pressable style={styles.selectBtn} onPress={() => setCivilModal(true)}>
                      <Text style={contactDraft.civil_status ? styles.selectBtnText : styles.selectBtnPlaceholder}>
                        {contactDraft.civil_status || "Select status"}
                      </Text>
                      <Ionicons name="chevron-down" size={14} color="#64748B" />
                    </Pressable>
                  ) : (
                    <ReadField value={textOrDash(contactDraft.civil_status)} />
                  )}
                </View>
              </View>

              <View style={styles.fieldFull}>
                <FieldLabel label="Complete Address" badge="self" />
                {contactEditing
                  ? <EditField value={contactDraft.complete_address} onChange={v => setContactDraft(d => ({ ...d, complete_address: v }))} placeholder="Street, Barangay, City, Province, ZIP" multiline />
                  : <ReadField value={textOrDash(contactDraft.complete_address)} />}
              </View>
            </View>

            {/* ── Resume ──────────────────────────────────────────────────── */}
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Resume</Text>
                  <Text style={styles.sectionMeta}>PDF, DOC, or DOCX — max 5 MB</Text>
                </View>
                <Pressable style={[styles.btn, styles.btnOutline]} onPress={pickAndUploadResume} disabled={resumeUploading}>
                  {resumeUploading
                    ? <ActivityIndicator size="small" color="#475569" />
                    : <>
                        <Ionicons name="cloud-upload-outline" size={13} color="#475569" style={{ marginRight: 4 }} />
                        <Text style={styles.btnOutlineText}>{resumeUrl ? "Replace" : "Upload"}</Text>
                      </>}
                </Pressable>
              </View>

              {resumeUrl ? (
                <View style={styles.resumeRow}>
                  <Ionicons name="document-text-outline" size={32} color="#1E40AF" style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resumeName} numberOfLines={1}>{resumeName}</Text>
                    {resumeUploadedAt && (
                      <Text style={styles.resumeDate}>
                        Uploaded {new Date(resumeUploadedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </Text>
                    )}
                  </View>
                  <Pressable style={styles.resumeDeleteBtn} onPress={deleteResume} disabled={resumeDeleting}>
                    {resumeDeleting
                      ? <ActivityIndicator size="small" color="#B91C1C" />
                      : <Ionicons name="trash-outline" size={18} color="#B91C1C" />}
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.resumeEmpty} onPress={pickAndUploadResume} disabled={resumeUploading}>
                  <Ionicons name="cloud-upload-outline" size={32} color="#94A3B8" />
                  <Text style={styles.resumeEmptyTitle}>Tap to upload your resume</Text>
                  <Text style={styles.resumeEmptyMeta}>PDF, DOC, DOCX up to 5MB</Text>
                </Pressable>
              )}
            </View>

            {/* ── SFIA Grade ───────────────────────────────────────────────── */}
            <View style={styles.card}>
              <View style={styles.sfiaHeaderRow}>
                <Text style={styles.sectionTitle}>SFIA Grade</Text>
                <View style={styles.sfiaBadge}>
                  <Text style={styles.sfiaBadgeText}>Skills Framework for the Information Age</Text>
                </View>
              </View>
              <Text style={styles.sfiaSub}>Your assessed skill level across active job applications.</Text>

              {sfiaGrade ? (
                <View style={styles.sfiaCard}>
                  <View style={styles.sfiaGradeCircle}>
                    <Text style={styles.sfiaGradeText}>{sfiaGrade}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 16 }}>
                    <Text style={styles.sfiaGradeLabel}>SFIA Grade {sfiaGrade}</Text>
                    {sfiaMatch !== null && (
                      <>
                        <Text style={styles.sfiaMatchLabel}>Job Match</Text>
                        <View style={styles.sfiaBar}>
                          <View style={[styles.sfiaBarFill, { width: `${sfiaMatch}%` as any }]} />
                        </View>
                        <Text style={styles.sfiaMatchPct}>{sfiaMatch}% match</Text>
                      </>
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.sfiaEmpty}>
                  <Ionicons name="ribbon-outline" size={28} color="#94A3B8" style={{ marginBottom: 8 }} />
                  <Text style={styles.sfiaEmptyText}>No SFIA grade assessed yet.</Text>
                  <Text style={styles.sfiaEmptyMeta}>Apply for a job to receive your skill assessment.</Text>
                </View>
              )}
            </View>
          </ScrollView>

          {isMobile && (
            <BottomTabBar role="applicant" activeScreen="Profile" navigation={navigation} session={session} />
          )}
        </View>
      </View>

      {/* Civil Status Picker Modal */}
      <Modal visible={civilModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setCivilModal(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Civil Status</Text>
            {CIVIL_STATUS_OPTIONS.map(opt => (
              <Pressable
                key={opt}
                style={[styles.modalOption, contactDraft.civil_status === opt && styles.modalOptionActive]}
                onPress={() => { setContactDraft(d => ({ ...d, civil_status: opt })); setCivilModal(false); }}
              >
                <Text style={[styles.modalOptionText, contactDraft.civil_status === opt && styles.modalOptionTextActive]}>
                  {opt}
                </Text>
                {contactDraft.civil_status === opt && <Ionicons name="checkmark" size={16} color="#1E40AF" />}
              </Pressable>
            ))}
            <Pressable style={styles.modalCancel} onPress={() => setCivilModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  inner: { flex: 1, flexDirection: "row" },
  main: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, color: "#64748B", fontSize: 14 },

  hero: { marginBottom: 0 },
  heroEyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1.8, color: "rgba(255,255,255,0.6)", marginBottom: 4, textTransform: "uppercase" },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", marginBottom: 4 },
  heroSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 18 },

  avatarCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#1E3A8A", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  avatarName: { fontSize: 15, fontWeight: "700", color: "#0F172A", marginBottom: 4 },
  rolePill: { backgroundColor: "#1E40AF", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 2, alignSelf: "flex-start" },
  rolePillText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700", textTransform: "uppercase" },

  card: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", gap: 12 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  sectionMeta: { fontSize: 11, color: "#94A3B8", marginTop: 2 },

  btnRow: { flexDirection: "row", gap: 8 },
  btn: { flexDirection: "row", alignItems: "center", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, minWidth: 60, justifyContent: "center" },
  btnPrimary: { backgroundColor: "#1E40AF" },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  btnOutline: { borderWidth: 1, borderColor: "#CBD5E1" },
  btnOutlineText: { color: "#475569", fontSize: 12, fontWeight: "600" },

  fieldGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  fieldCell: { width: "47%", gap: 4 },
  fieldFull: { gap: 4 },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  fieldLabel: { fontSize: 9, fontWeight: "700", color: "#94A3B8", letterSpacing: 1.5 },
  badgeSelf: { backgroundColor: "#DCFCE7", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: "#BBF7D0" },
  badgeSelfText: { color: "#166534", fontSize: 8, fontWeight: "700", textTransform: "uppercase" },
  badgeSystem: { backgroundColor: "#F1F5F9", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: "#E2E8F0" },
  badgeSystemText: { color: "#94A3B8", fontSize: 8, fontWeight: "700", textTransform: "uppercase" },

  readField: { backgroundColor: "#F8FAFC", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  readFieldText: { fontSize: 14, color: "#475569" },
  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14, color: "#0F172A", backgroundColor: "#FFFFFF" },
  inputMulti: { minHeight: 80, textAlignVertical: "top" },

  selectBtn: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFFFFF" },
  selectBtnText: { fontSize: 14, color: "#0F172A" },
  selectBtnPlaceholder: { fontSize: 14, color: "#94A3B8" },

  resumeRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  resumeName: { fontSize: 14, fontWeight: "600", color: "#0F172A", flex: 1 },
  resumeDate: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  resumeDeleteBtn: { padding: 6 },
  resumeEmpty: { borderWidth: 2, borderStyle: "dashed", borderColor: "#CBD5E1", borderRadius: 10, padding: 28, alignItems: "center", gap: 6 },
  resumeEmptyTitle: { fontSize: 14, fontWeight: "600", color: "#64748B" },
  resumeEmptyMeta: { fontSize: 12, color: "#94A3B8" },

  sfiaHeaderRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  sfiaBadge: { backgroundColor: "#F1F5F9", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: "#E2E8F0" },
  sfiaBadgeText: { fontSize: 9, color: "#94A3B8", fontWeight: "600" },
  sfiaSub: { fontSize: 12, color: "#64748B" },
  sfiaCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#F0F9FF", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#BAE6FD" },
  sfiaGradeCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#1E40AF", alignItems: "center", justifyContent: "center" },
  sfiaGradeText: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  sfiaGradeLabel: { fontSize: 14, fontWeight: "700", color: "#0F172A", marginBottom: 6 },
  sfiaMatchLabel: { fontSize: 11, color: "#64748B", marginBottom: 4 },
  sfiaBar: { height: 6, backgroundColor: "#E0F2FE", borderRadius: 3, overflow: "hidden", marginBottom: 4 },
  sfiaBarFill: { height: 6, backgroundColor: "#1E40AF", borderRadius: 3 },
  sfiaMatchPct: { fontSize: 11, fontWeight: "600", color: "#1E40AF" },
  sfiaEmpty: { alignItems: "center", paddingVertical: 20 },
  sfiaEmptyText: { fontSize: 14, color: "#64748B", fontWeight: "600" },
  sfiaEmptyMeta: { fontSize: 12, color: "#94A3B8", marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 4 },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 8 },
  modalOption: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  modalOptionActive: { backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 10 },
  modalOptionText: { fontSize: 15, color: "#0F172A" },
  modalOptionTextActive: { color: "#1E40AF", fontWeight: "600" },
  modalCancel: { marginTop: 8, alignItems: "center", paddingVertical: 12 },
  modalCancelText: { fontSize: 15, color: "#94A3B8" },
});
