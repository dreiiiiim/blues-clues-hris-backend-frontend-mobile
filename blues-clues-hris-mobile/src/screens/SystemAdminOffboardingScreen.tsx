import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
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

type TemplateCategory = "document" | "task" | "equipment" | "hr_form" | "system_access";

type TemplateItem = {
  title: string;
  description?: string;
  is_required: boolean;
  category: TemplateCategory;
};

type Template = {
  template_id: string;
  template_name: string;
  company_id: string;
  items?: TemplateItem[];
};

type Company = { company_id: string; company_name: string };

const CATEGORY_OPTIONS: TemplateCategory[] = ["document", "task", "equipment", "hr_form", "system_access"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function categoryLabel(c: TemplateCategory) {
  return c.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function SystemAdminOffboardingScreen({ route, navigation }: any) {
  const session: UserSession = route.params?.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // Template form modal
  const [formOpen, setFormOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    authFetch(`${API_BASE_URL}/users/companies`)
      .then(r => r.json())
      .then((data: Company[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setCompanies(data);
          setSelectedCompany(data[0]);
          loadTemplates(data[0].company_id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function loadTemplates(companyId: string) {
    setTemplatesLoading(true);
    authFetch(`${API_BASE_URL}/offboarding/system-admin/tenants/${companyId}/checklist-templates`)
      .then(r => r.json())
      .then((data: Template[]) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setTemplatesLoading(false));
  }

  function openCreate() {
    setEditTemplate(null);
    setTemplateName("");
    setTemplateItems([]);
    setFormOpen(true);
  }

  function openEdit(t: Template) {
    setEditTemplate(t);
    setTemplateName(t.template_name);
    setTemplateItems(t.items ? [...t.items] : []);
    setFormOpen(true);
  }

  async function save() {
    if (!templateName.trim() || !selectedCompany) return;
    setSaving(true);
    try {
      const companyId = selectedCompany.company_id;
      const payload = { template_name: templateName.trim(), items: templateItems };
      let res: Response;
      if (editTemplate) {
        res = await authFetch(`${API_BASE_URL}/offboarding/system-admin/tenants/${companyId}/checklist-templates/${editTemplate.template_id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      } else {
        res = await authFetch(`${API_BASE_URL}/offboarding/system-admin/tenants/${companyId}/checklist-templates`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      }
      if (!res.ok) throw new Error();
      setFormOpen(false);
      loadTemplates(companyId);
    } catch {
      Alert.alert("Error", "Failed to save template.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(t: Template) {
    if (!selectedCompany) return;
    Alert.alert("Delete Template", `Delete "${t.template_name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          setDeleting(t.template_id);
          try {
            await authFetch(`${API_BASE_URL}/offboarding/system-admin/tenants/${selectedCompany.company_id}/checklist-templates/${t.template_id}`, { method: "DELETE" });
            setTemplates(prev => prev.filter(x => x.template_id !== t.template_id));
          } catch {
            Alert.alert("Error", "Delete failed.");
          } finally {
            setDeleting(null);
          }
        },
      },
    ]);
  }

  function addItem() {
    setTemplateItems(prev => [...prev, { title: "", category: "task", is_required: false }]);
  }

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}><ActivityIndicator size="large" color="#1E40AF" /><Text style={s.loadingText}>Loading...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        {!isMobile && (
          <Sidebar role="system_admin" userName={session?.name ?? ""} email={session?.email ?? ""} activeScreen="Offboarding" navigation={navigation} />
        )}

        <View style={s.main}>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={[s.scrollContent, isMobile && { paddingBottom: BOTTOM_TAB_HEIGHT + 8 }]}
            showsVerticalScrollIndicator={false}
          >
            <GradientHero>
              <Text style={s.heroEyebrow}>System Admin</Text>
              <Text style={s.heroTitle}>Offboarding</Text>
              <Text style={s.heroSub}>Manage offboarding checklist templates per company tenant.</Text>
            </GradientHero>

            {/* Company selector */}
            {companies.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.companyRow}>
                {companies.map(c => (
                  <Pressable key={c.company_id} style={[s.companyChip, selectedCompany?.company_id === c.company_id && s.companyChipActive]}
                    onPress={() => { setSelectedCompany(c); loadTemplates(c.company_id); }}>
                    <Text style={[s.companyText, selectedCompany?.company_id === c.company_id && s.companyTextActive]}>{c.company_name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <Pressable style={s.createBtn} onPress={openCreate}>
              <Ionicons name="add-circle-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={s.createBtnText}>Create Template</Text>
            </Pressable>

            {templatesLoading ? (
              <View style={s.centered}><ActivityIndicator color="#1E40AF" /></View>
            ) : templates.length === 0 ? (
              <View style={s.emptyBox}><Text style={s.emptyText}>No offboarding templates yet. Create one above.</Text></View>
            ) : (
              templates.map(t => (
                <View key={t.template_id} style={s.templateCard}>
                  <View style={s.templateTop}>
                    <Text style={s.templateName}>{t.template_name}</Text>
                    <View style={s.templateActions}>
                      <Pressable style={s.editBtn} onPress={() => openEdit(t)}>
                        <Ionicons name="pencil-outline" size={14} color="#1E40AF" />
                      </Pressable>
                      <Pressable style={s.deleteBtn} onPress={() => deleteTemplate(t)} disabled={deleting === t.template_id}>
                        {deleting === t.template_id ? <ActivityIndicator size="small" color="#B91C1C" /> : <Ionicons name="trash-outline" size={14} color="#B91C1C" />}
                      </Pressable>
                    </View>
                  </View>
                  {(t.items?.length ?? 0) > 0 && (
                    <Text style={s.templateMeta}>{t.items!.length} item{t.items!.length !== 1 ? "s" : ""}</Text>
                  )}
                  {t.items?.slice(0, 3).map((item, idx) => (
                    <View key={idx} style={s.itemPreview}>
                      <Ionicons name={item.is_required ? "star" : "ellipse-outline"} size={10} color={item.is_required ? "#1E40AF" : "#94A3B8"} style={{ marginRight: 6 }} />
                      <Text style={s.itemPreviewText}>{item.title || "Untitled item"}</Text>
                      <Text style={s.itemCatText}>{categoryLabel(item.category)}</Text>
                    </View>
                  ))}
                  {(t.items?.length ?? 0) > 3 && <Text style={s.moreItems}>+{t.items!.length - 3} more items</Text>}
                </View>
              ))
            )}
          </ScrollView>

          {isMobile && (
            <BottomTabBar role="system_admin" activeScreen="Offboarding" navigation={navigation} session={session} />
          )}
        </View>
      </View>

      {/* Template Form Modal */}
      <Modal visible={formOpen} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
          <View style={s.formHeader}>
            <Text style={s.formHeaderTitle}>{editTemplate ? "Edit Template" : "Create Template"}</Text>
            <Pressable onPress={() => setFormOpen(false)}><Ionicons name="close" size={22} color="#475569" /></Pressable>
          </View>
          <ScrollView contentContainerStyle={s.formContent}>
            <Text style={s.fieldLabel}>TEMPLATE NAME *</Text>
            <TextInput style={s.input} value={templateName} onChangeText={setTemplateName} placeholder="e.g. Standard Offboarding" placeholderTextColor="#94A3B8" />

            <View style={s.itemsHeader}>
              <Text style={s.fieldLabel}>CHECKLIST ITEMS ({templateItems.length})</Text>
              <Pressable style={s.addItemBtn} onPress={addItem}>
                <Ionicons name="add" size={14} color="#1E40AF" style={{ marginRight: 4 }} />
                <Text style={s.addItemBtnText}>Add Item</Text>
              </Pressable>
            </View>

            {templateItems.map((item, idx) => (
              <View key={idx} style={s.itemForm}>
                <View style={s.itemFormHeader}>
                  <Text style={s.itemFormLabel}>Item {idx + 1}</Text>
                  <Pressable onPress={() => setTemplateItems(prev => prev.filter((_, i) => i !== idx))}>
                    <Ionicons name="close-circle" size={18} color="#B91C1C" />
                  </Pressable>
                </View>
                <TextInput
                  style={s.input}
                  value={item.title}
                  onChangeText={v => setTemplateItems(prev => prev.map((it, i) => i === idx ? { ...it, title: v } : it))}
                  placeholder="Item title"
                  placeholderTextColor="#94A3B8"
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {CATEGORY_OPTIONS.map(cat => (
                    <Pressable
                      key={cat}
                      style={[s.catChip, item.category === cat && s.catChipActive]}
                      onPress={() => setTemplateItems(prev => prev.map((it, i) => i === idx ? { ...it, category: cat } : it))}
                    >
                      <Text style={[s.catChipText, item.category === cat && s.catChipTextActive]}>{categoryLabel(cat)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={s.requiredRow}>
                  <Text style={s.requiredLabel}>Required</Text>
                  <Switch
                    value={item.is_required}
                    onValueChange={v => setTemplateItems(prev => prev.map((it, i) => i === idx ? { ...it, is_required: v } : it))}
                    trackColor={{ true: "#1E40AF", false: "#E2E8F0" }}
                  />
                </View>
              </View>
            ))}

            <View style={s.formBtnRow}>
              <Pressable style={[s.btn, s.btnOutline]} onPress={() => setFormOpen(false)} disabled={saving}><Text style={s.btnOutlineText}>Cancel</Text></Pressable>
              <Pressable style={[s.btn, s.btnPrimary]} onPress={save} disabled={saving || !templateName.trim()}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPrimaryText}>Save Template</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  inner: { flex: 1, flexDirection: "row" },
  main: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  loadingText: { marginTop: 12, color: "#64748B", fontSize: 14 },

  heroEyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1.8, color: "rgba(255,255,255,0.6)", marginBottom: 4, textTransform: "uppercase" },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", marginBottom: 4 },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.75)" },

  companyRow: { flexDirection: "row" },
  companyChip: { paddingHorizontal: 14, paddingVertical: 7, marginRight: 8, borderRadius: 20, backgroundColor: "#F1F5F9" },
  companyChipActive: { backgroundColor: "#1E40AF" },
  companyText: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  companyTextActive: { color: "#FFFFFF" },

  createBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E40AF", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, alignSelf: "flex-start" },
  createBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  emptyBox: { backgroundColor: "#F1F5F9", borderRadius: 12, padding: 24, alignItems: "center" },
  emptyText: { fontSize: 13, color: "#64748B", textAlign: "center" },

  templateCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", gap: 8 },
  templateTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  templateName: { fontSize: 14, fontWeight: "700", color: "#0F172A", flex: 1 },
  templateActions: { flexDirection: "row", gap: 8 },
  editBtn: { padding: 6, backgroundColor: "#EFF6FF", borderRadius: 6 },
  deleteBtn: { padding: 6, backgroundColor: "#FEF2F2", borderRadius: 6 },
  templateMeta: { fontSize: 12, color: "#64748B" },
  itemPreview: { flexDirection: "row", alignItems: "center" },
  itemPreviewText: { fontSize: 12, color: "#475569", flex: 1 },
  itemCatText: { fontSize: 10, color: "#94A3B8" },
  moreItems: { fontSize: 11, color: "#94A3B8" },

  formHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  formHeaderTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  formContent: { padding: 16, gap: 12 },
  fieldLabel: { fontSize: 10, fontWeight: "700", color: "#94A3B8", letterSpacing: 1.2, textTransform: "uppercase" },
  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#0F172A" },
  itemsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  addItemBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  addItemBtnText: { fontSize: 12, color: "#1E40AF", fontWeight: "600" },
  itemForm: { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E2E8F0", gap: 8 },
  itemFormHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemFormLabel: { fontSize: 12, fontWeight: "600", color: "#1E293B" },
  catChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#FFFFFF" },
  catChipActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  catChipText: { fontSize: 11, color: "#64748B", fontWeight: "600" },
  catChipTextActive: { color: "#FFFFFF" },
  requiredRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  requiredLabel: { fontSize: 13, color: "#475569" },
  formBtnRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  btn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 10, paddingVertical: 11 },
  btnPrimary: { backgroundColor: "#1E40AF" },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  btnOutline: { borderWidth: 1, borderColor: "#CBD5E1" },
  btnOutlineText: { color: "#475569", fontWeight: "600", fontSize: 14 },
});
