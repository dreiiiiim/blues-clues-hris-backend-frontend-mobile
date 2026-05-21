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
import { Ionicons } from "@expo/vector-icons";
import { Sidebar } from "../components/Sidebar";
import { BottomTabBar, BOTTOM_TAB_HEIGHT } from "../components/BottomTabBar";
import { GradientHero } from "../components/GradientHero";
import { authFetch, type UserSession } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type EmergencyContact = {
  contact_id?: string;
  name: string;
  relationship: string;
  phone_number: string;
  email?: string;
};

type EmployeeProfile = {
  user_id: string;
  employee_id?: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  middle_name?: string | null;
  department_name?: string | null;
  position_title?: string | null;
  personal_email?: string | null;
  complete_address?: string | null;
  date_of_birth?: string | null;
  place_of_birth?: string | null;
  nationality?: string | null;
  civil_status?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_name?: string | null;
  avatar_url?: string | null;
  emergency_contacts?: EmergencyContact[];
};

type ExtendedDraft = {
  personalEmail: string;
  address: string;
  dob: string;
  placeOfBirth: string;
  nationality: string;
  civilStatus: string;
};

const CIVIL_STATUS_OPTIONS = ["Single", "Married", "Widowed", "Separated"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function val(v: string | null | undefined) { return v?.trim() || "—"; }
function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, editing, saving, onEdit, onSave, onCancel }: {
  title: string; editing: boolean; saving: boolean;
  onEdit?: () => void; onSave?: () => void; onCancel?: () => void;
}) {
  return (
    <View style={s.sectionHeaderRow}>
      <Text style={s.sectionTitle}>{title}</Text>
      {onEdit && !editing && (
        <Pressable style={[s.btn, s.btnOutline]} onPress={onEdit}>
          <Ionicons name="pencil-outline" size={12} color="#475569" style={{ marginRight: 3 }} />
          <Text style={s.btnOutlineText}>Edit</Text>
        </Pressable>
      )}
      {editing && (
        <View style={s.btnRow}>
          <Pressable style={[s.btn, s.btnPrimary]} onPress={onSave} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPrimaryText}>Save</Text>}
          </Pressable>
          <Pressable style={[s.btn, s.btnOutline]} onPress={onCancel} disabled={saving}>
            <Text style={s.btnOutlineText}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

function EditRow({ label, value, onChange, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  return (
    <View style={s.editRow}>
      <Text style={s.editLabel}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function EmployeeProfileScreen({ route, navigation }: any) {
  const session: UserSession = route.params?.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Extended / contact
  const [extDraft, setExtDraft] = useState<ExtendedDraft>({ personalEmail: "", address: "", dob: "", placeOfBirth: "", nationality: "", civilStatus: "" });
  const [extEditing, setExtEditing] = useState(false);
  const [extSaving, setExtSaving] = useState(false);
  const [civilModal, setCivilModal] = useState(false);

  // Emergency contacts
  const [ecList, setEcList] = useState<EmergencyContact[]>([]);
  const [ecDraft, setEcDraft] = useState<EmergencyContact[]>([]);
  const [ecEditing, setEcEditing] = useState(false);
  const [ecSaving, setEcSaving] = useState(false);

  // Change request modal
  const [changeModal, setChangeModal] = useState<{ open: boolean; section: "legal-name" | "bank" } | null>(null);
  const [changeReason, setChangeReason] = useState("");
  const [changeValue, setChangeValue] = useState("");
  const [changeSubmitting, setChangeSubmitting] = useState(false);

  useEffect(() => {
    authFetch(`${API_BASE_URL}/users/me`)
      .then(r => r.json())
      .then((p: EmployeeProfile) => {
        setProfile(p);
        setExtDraft({
          personalEmail: p.personal_email ?? "",
          address: p.complete_address ?? "",
          dob: p.date_of_birth ?? "",
          placeOfBirth: p.place_of_birth ?? "",
          nationality: p.nationality ?? "",
          civilStatus: p.civil_status ?? "",
        });
        setEcList(p.emergency_contacts ?? []);
        setEcDraft(p.emergency_contacts ?? []);
      })
      .catch(() => Alert.alert("Error", "Failed to load profile."))
      .finally(() => setLoading(false));
  }, []);

  async function saveExtended() {
    setExtSaving(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/users/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personal_email: extDraft.personalEmail.trim() || null,
          complete_address: extDraft.address.trim() || null,
          date_of_birth: extDraft.dob || null,
          place_of_birth: extDraft.placeOfBirth.trim() || null,
          nationality: extDraft.nationality.trim() || null,
          civil_status: extDraft.civilStatus || null,
        }),
      });
      const updated: EmployeeProfile = await res.json();
      setProfile(prev => prev ? { ...prev, ...updated } : updated);
      setExtEditing(false);
    } catch {
      Alert.alert("Error", "Save failed.");
    } finally {
      setExtSaving(false);
    }
  }

  async function saveEmergencyContacts() {
    setEcSaving(true);
    try {
      await authFetch(`${API_BASE_URL}/users/me/emergency-contacts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ecDraft),
      });
      setEcList(ecDraft);
      setEcEditing(false);
    } catch {
      Alert.alert("Error", "Failed to save contacts.");
    } finally {
      setEcSaving(false);
    }
  }

  async function submitChangeRequest() {
    if (!changeReason.trim() || changeReason.trim().length < 5) {
      Alert.alert("Validation", "Please provide a reason (at least 5 characters).");
      return;
    }
    setChangeSubmitting(true);
    try {
      await authFetch(`${API_BASE_URL}/users/me/change-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_type: changeModal?.section === "legal-name" ? "legal_name" : "bank",
          requested_value: changeValue,
          reason: changeReason.trim(),
        }),
      });
      Alert.alert("Success", "Change request submitted — awaiting HR approval.");
      setChangeModal(null);
      setChangeReason("");
      setChangeValue("");
    } catch {
      Alert.alert("Error", "Failed to submit change request.");
    } finally {
      setChangeSubmitting(false);
    }
  }

  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || session?.name || "Employee";
  const initials = displayName.charAt(0).toUpperCase();

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#1E40AF" />
          <Text style={s.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        {!isMobile && (
          <Sidebar role="employee" userName={session?.name ?? ""} email={session?.email ?? ""} activeScreen="Profile" navigation={navigation} />
        )}

        <View style={s.main}>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={[s.scrollContent, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]}
            showsVerticalScrollIndicator={false}
          >
            <GradientHero>
              <Text style={s.heroEyebrow}>Employee Self-Service</Text>
              <Text style={s.heroTitle}>My Profile</Text>
              <Text style={s.heroSub}>Manage your personal details, contact info, and emergency contacts.</Text>
            </GradientHero>

            {/* Avatar card */}
            <View style={s.avatarCard}>
              <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.avatarName}>{displayName}</Text>
                {profile?.department_name ? <Text style={s.avatarDept}>{profile.department_name}</Text> : null}
                <View style={s.rolePill}><Text style={s.rolePillText}>Employee</Text></View>
              </View>
            </View>

            {/* ── Personal Information (Legal Name) ───────────────────────── */}
            <View style={s.card}>
              <SectionHeader title="Personal Information" editing={false} saving={false} />
              <InfoRow label="First Name" value={val(profile?.first_name)} />
              <InfoRow label="Middle Name" value={val(profile?.middle_name)} />
              <InfoRow label="Last Name" value={val(profile?.last_name)} />
              <InfoRow label="Work Email" value={val(profile?.email)} />
              <InfoRow label="Employee ID" value={val(profile?.employee_id)} />
              <InfoRow label="Department" value={val(profile?.department_name)} />
              <InfoRow label="Position" value={val(profile?.position_title)} />
              <Pressable
                style={s.requestBtn}
                onPress={() => { setChangeModal({ open: true, section: "legal-name" }); setChangeValue(`${profile?.first_name ?? ""} ${profile?.middle_name ?? ""} ${profile?.last_name ?? ""}`.trim()); }}
              >
                <Ionicons name="create-outline" size={14} color="#1E40AF" style={{ marginRight: 6 }} />
                <Text style={s.requestBtnText}>Request Legal Name Change</Text>
              </Pressable>
            </View>

            {/* ── Contact & Address ───────────────────────────────────────── */}
            <View style={s.card}>
              <SectionHeader
                title="Contact & Address"
                editing={extEditing}
                saving={extSaving}
                onEdit={() => setExtEditing(true)}
                onSave={saveExtended}
                onCancel={() => { setExtEditing(false); setExtDraft({ personalEmail: profile?.personal_email ?? "", address: profile?.complete_address ?? "", dob: profile?.date_of_birth ?? "", placeOfBirth: profile?.place_of_birth ?? "", nationality: profile?.nationality ?? "", civilStatus: profile?.civil_status ?? "" }); }}
              />

              {extEditing ? (
                <>
                  <EditRow label="Personal Email" value={extDraft.personalEmail} onChange={v => setExtDraft(d => ({ ...d, personalEmail: v }))} placeholder="personal@email.com" />
                  <EditRow label="Date of Birth (YYYY-MM-DD)" value={extDraft.dob} onChange={v => setExtDraft(d => ({ ...d, dob: v }))} placeholder="YYYY-MM-DD" />
                  <EditRow label="Place of Birth" value={extDraft.placeOfBirth} onChange={v => setExtDraft(d => ({ ...d, placeOfBirth: v }))} placeholder="City, Province" />
                  <EditRow label="Nationality" value={extDraft.nationality} onChange={v => setExtDraft(d => ({ ...d, nationality: v }))} placeholder="e.g. Filipino" />
                  <View style={s.editRow}>
                    <Text style={s.editLabel}>Civil Status</Text>
                    <Pressable style={s.selectBtn} onPress={() => setCivilModal(true)}>
                      <Text style={extDraft.civilStatus ? s.selectBtnText : s.selectBtnPlaceholder}>{extDraft.civilStatus || "Select status"}</Text>
                      <Ionicons name="chevron-down" size={14} color="#64748B" />
                    </Pressable>
                  </View>
                  <EditRow label="Complete Address" value={extDraft.address} onChange={v => setExtDraft(d => ({ ...d, address: v }))} placeholder="Street, Barangay, City, Province, ZIP" multiline />
                </>
              ) : (
                <>
                  <InfoRow label="Personal Email" value={val(profile?.personal_email)} />
                  <InfoRow label="Date of Birth" value={formatDate(profile?.date_of_birth)} />
                  <InfoRow label="Place of Birth" value={val(profile?.place_of_birth)} />
                  <InfoRow label="Nationality" value={val(profile?.nationality)} />
                  <InfoRow label="Civil Status" value={val(profile?.civil_status)} />
                  <InfoRow label="Complete Address" value={val(profile?.complete_address)} />
                </>
              )}
            </View>

            {/* ── Bank Information ────────────────────────────────────────── */}
            <View style={s.card}>
              <SectionHeader title="Bank Information" editing={false} saving={false} />
              <InfoRow label="Bank Name" value={val(profile?.bank_name)} />
              <InfoRow label="Account Number" value={profile?.bank_account_number ? `****${profile.bank_account_number.slice(-4)}` : "—"} />
              <InfoRow label="Account Name" value={val(profile?.bank_account_name)} />
              <Pressable
                style={s.requestBtn}
                onPress={() => { setChangeModal({ open: true, section: "bank" }); setChangeValue(""); }}
              >
                <Ionicons name="create-outline" size={14} color="#1E40AF" style={{ marginRight: 6 }} />
                <Text style={s.requestBtnText}>Request Bank Update</Text>
              </Pressable>
            </View>

            {/* ── Emergency Contacts ──────────────────────────────────────── */}
            <View style={s.card}>
              <SectionHeader
                title="Emergency Contacts"
                editing={ecEditing}
                saving={ecSaving}
                onEdit={() => { setEcDraft([...ecList]); setEcEditing(true); }}
                onSave={saveEmergencyContacts}
                onCancel={() => { setEcDraft([...ecList]); setEcEditing(false); }}
              />

              {ecEditing ? (
                <>
                  {ecDraft.map((ec, idx) => (
                    <View key={idx} style={s.ecCard}>
                      <View style={s.ecCardHeader}>
                        <Text style={s.ecCardTitle}>Contact {idx + 1}</Text>
                        <Pressable onPress={() => setEcDraft(d => d.filter((_, i) => i !== idx))}>
                          <Ionicons name="trash-outline" size={16} color="#B91C1C" />
                        </Pressable>
                      </View>
                      <TextInput style={s.input} value={ec.name} onChangeText={v => setEcDraft(d => d.map((c, i) => i === idx ? { ...c, name: v } : c))} placeholder="Full name" placeholderTextColor="#94A3B8" />
                      <TextInput style={s.input} value={ec.relationship} onChangeText={v => setEcDraft(d => d.map((c, i) => i === idx ? { ...c, relationship: v } : c))} placeholder="Relationship" placeholderTextColor="#94A3B8" />
                      <TextInput style={s.input} value={ec.phone_number} onChangeText={v => setEcDraft(d => d.map((c, i) => i === idx ? { ...c, phone_number: v } : c))} placeholder="Phone number" placeholderTextColor="#94A3B8" keyboardType="phone-pad" />
                    </View>
                  ))}
                  <Pressable style={s.addBtn} onPress={() => setEcDraft(d => [...d, { name: "", relationship: "", phone_number: "" }])}>
                    <Ionicons name="add-circle-outline" size={16} color="#1E40AF" style={{ marginRight: 6 }} />
                    <Text style={s.addBtnText}>Add Contact</Text>
                  </Pressable>
                </>
              ) : ecList.length === 0 ? (
                <Text style={s.emptyText}>No emergency contacts on file.</Text>
              ) : (
                ecList.map((ec, idx) => (
                  <View key={idx} style={s.ecInfo}>
                    <Text style={s.ecName}>{ec.name}</Text>
                    <Text style={s.ecMeta}>{ec.relationship} · {ec.phone_number}</Text>
                  </View>
                ))
              )}
            </View>
          </ScrollView>

          {isMobile && (
            <BottomTabBar role="employee" activeScreen="Profile" navigation={navigation} session={session} />
          )}
        </View>
      </View>

      {/* Civil Status Picker */}
      <Modal visible={civilModal} transparent animationType="slide">
        <Pressable style={s.modalOverlay} onPress={() => setCivilModal(false)}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Civil Status</Text>
            {CIVIL_STATUS_OPTIONS.map(opt => (
              <Pressable
                key={opt}
                style={[s.modalOption, extDraft.civilStatus === opt && s.modalOptionActive]}
                onPress={() => { setExtDraft(d => ({ ...d, civilStatus: opt })); setCivilModal(false); }}
              >
                <Text style={[s.modalOptionText, extDraft.civilStatus === opt && s.modalOptionTextActive]}>{opt}</Text>
                {extDraft.civilStatus === opt && <Ionicons name="checkmark" size={16} color="#1E40AF" />}
              </Pressable>
            ))}
            <Pressable style={s.modalCancel} onPress={() => setCivilModal(false)}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Change Request Modal */}
      {changeModal && (
        <Modal visible={changeModal.open} transparent animationType="slide">
          <Pressable style={s.modalOverlay} onPress={() => setChangeModal(null)}>
            <View style={s.modalSheet}>
              <Text style={s.modalTitle}>{changeModal.section === "legal-name" ? "Request Legal Name Change" : "Request Bank Update"}</Text>
              <Text style={s.modalDesc}>This will be reviewed by HR before any changes are applied.</Text>
              {changeModal.section === "legal-name" && (
                <TextInput style={[s.input, { marginBottom: 8 }]} value={changeValue} onChangeText={setChangeValue} placeholder="New legal name" placeholderTextColor="#94A3B8" />
              )}
              {changeModal.section === "bank" && (
                <TextInput style={[s.input, { marginBottom: 8 }]} value={changeValue} onChangeText={setChangeValue} placeholder="New bank details (Bank, Account #, Name)" placeholderTextColor="#94A3B8" multiline numberOfLines={3} />
              )}
              <TextInput style={[s.input, s.inputMulti, { marginBottom: 12 }]} value={changeReason} onChangeText={setChangeReason} placeholder="Reason for change request..." placeholderTextColor="#94A3B8" multiline numberOfLines={3} />
              <View style={s.btnRow}>
                <Pressable style={[s.btn, s.btnOutline, { flex: 1 }]} onPress={() => { setChangeModal(null); setChangeReason(""); setChangeValue(""); }}>
                  <Text style={s.btnOutlineText}>Cancel</Text>
                </Pressable>
                <Pressable style={[s.btn, s.btnPrimary, { flex: 1 }]} onPress={submitChangeRequest} disabled={changeSubmitting}>
                  {changeSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPrimaryText}>Submit</Text>}
                </Pressable>
              </View>
            </View>
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
  heroSub: { fontSize: 13, color: "rgba(255,255,255,0.7)" },

  avatarCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#1E3A8A", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  avatarName: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  avatarDept: { fontSize: 12, color: "#64748B", marginTop: 1, marginBottom: 4 },
  rolePill: { backgroundColor: "#1E40AF", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" },
  rolePillText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700", textTransform: "uppercase" },

  card: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", gap: 10 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  btnRow: { flexDirection: "row", gap: 8 },
  btn: { flexDirection: "row", alignItems: "center", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, justifyContent: "center" },
  btnPrimary: { backgroundColor: "#1E40AF" },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  btnOutline: { borderWidth: 1, borderColor: "#CBD5E1" },
  btnOutlineText: { color: "#475569", fontSize: 12, fontWeight: "600" },

  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  infoLabel: { fontSize: 12, color: "#94A3B8", flex: 1 },
  infoValue: { fontSize: 13, color: "#0F172A", fontWeight: "500", flex: 2, textAlign: "right" },

  editRow: { gap: 4 },
  editLabel: { fontSize: 10, fontWeight: "700", color: "#94A3B8", letterSpacing: 1, textTransform: "uppercase" },
  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14, color: "#0F172A" },
  inputMulti: { minHeight: 72, textAlignVertical: "top" },
  selectBtn: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  selectBtnText: { fontSize: 14, color: "#0F172A" },
  selectBtnPlaceholder: { fontSize: 14, color: "#94A3B8" },

  requestBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#EFF6FF", borderRadius: 8, alignSelf: "flex-start", marginTop: 4 },
  requestBtnText: { fontSize: 13, color: "#1E40AF", fontWeight: "600" },

  ecCard: { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 12, gap: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  ecCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ecCardTitle: { fontSize: 13, fontWeight: "600", color: "#1E293B" },
  ecInfo: { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  ecName: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  ecMeta: { fontSize: 12, color: "#64748B", marginTop: 2 },
  addBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, backgroundColor: "#EFF6FF", borderRadius: 8, alignSelf: "flex-start" },
  addBtnText: { fontSize: 13, color: "#1E40AF", fontWeight: "600" },
  emptyText: { fontSize: 13, color: "#94A3B8", textAlign: "center", paddingVertical: 12 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 8 },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 4 },
  modalDesc: { fontSize: 13, color: "#64748B", marginBottom: 8 },
  modalOption: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  modalOptionActive: { backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 8 },
  modalOptionText: { fontSize: 15, color: "#0F172A" },
  modalOptionTextActive: { color: "#1E40AF", fontWeight: "600" },
  modalCancel: { marginTop: 8, alignItems: "center", paddingVertical: 12 },
  modalCancelText: { fontSize: 15, color: "#94A3B8" },
});
