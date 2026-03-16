import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { login, saveSession } from "../services/auth";
import { Colors } from "../constants/colors";

export const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.length > 0 && !loading,
    [email, password, loading],
  );

  async function onSubmit() {
    setError(null);
    setLoading(true);
    const res = await login(email.trim(), password, rememberMe);
    setLoading(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    if (res.user.role === "applicant") {
      setError("Applicants must sign in via the Applicant Portal.");
      return;
    }

    await saveSession(res.user, rememberMe);

    switch (res.user.role) {
      case "employee":     navigation.replace("EmployeeDashboard",    { session: res.user }); break;
      case "hr":           navigation.replace("HROfficerDashboard",   { session: res.user }); break;
      case "manager":      navigation.replace("ManagerDashboard",     { session: res.user }); break;
      case "system_admin":
      case "admin":        navigation.replace("SystemAdminDashboard", { session: res.user }); break;
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bgApp }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand header */}
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "800" }}>B</Text>
          </View>
          <Text style={{ color: Colors.textPrimary, fontSize: 20, fontWeight: "800" }}>Blue's Clues HRIS</Text>
          <Text style={{ color: Colors.textMuted, fontSize: 13, marginTop: 4 }}>Employee, Manager & HR Portal</Text>
        </View>

        <View style={{ borderRadius: 20, backgroundColor: "#FFFFFF", padding: 22, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 4 }}>
          <View>
            <Text style={{ color: Colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Email / Username</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="Enter email or username"
              placeholderTextColor={Colors.textPlaceholder}
              style={{ borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary }}
            />
          </View>

          <View style={{ marginTop: 16 }}>
            <Text style={{ color: Colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={Colors.textPlaceholder}
              style={{ borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary }}
            />
          </View>

          {error ? (
            <View style={{ backgroundColor: Colors.dangerLight, marginTop: 14, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: "#FECACA" }}>
              <Text style={{ color: Colors.dangerText, fontSize: 13, fontWeight: "600" }}>{error}</Text>
            </View>
          ) : null}

          <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable style={{ flexDirection: "row", alignItems: "center" }} onPress={() => setRememberMe((v) => !v)}>
              <View style={{
                width: 20, height: 20, borderRadius: 6, borderWidth: 2,
                backgroundColor: rememberMe ? Colors.primary : "transparent",
                borderColor: rememberMe ? Colors.primary : Colors.textPlaceholder,
                alignItems: "center", justifyContent: "center",
              }}>
                {rememberMe && <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>✓</Text>}
              </View>
              <Text style={{ color: Colors.textSecondary, marginLeft: 8, fontSize: 13 }}>Remember Me</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate("ForgotPassword")}>
              <Text style={{ color: Colors.primary, fontSize: 13, fontWeight: "700" }}>Forgot Password?</Text>
            </Pressable>
          </View>

          <Pressable
            style={{
              marginTop: 20,
              borderRadius: 12,
              paddingVertical: 14,
              backgroundColor: canSubmit ? Colors.primary : Colors.primaryDisabled,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
            }}
            disabled={!canSubmit}
            onPress={onSubmit}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 15 }}>Sign In →</Text>
            )}
          </Pressable>

          <View style={{ height: 1, backgroundColor: Colors.border, marginTop: 20, marginBottom: 16 }} />

          <Pressable
            style={{ borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingVertical: 13, alignItems: "center" }}
            onPress={() => navigation.navigate("SignUp")}
          >
            <Text style={{ color: Colors.textPrimary, fontWeight: "700", fontSize: 14 }}>Go to Applicant Portal →</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
