import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { login, saveSession } from "../services/auth";
import { Colors } from "../constants/colors";

export const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.length > 0 && !loading,
    [email, password, loading]
  );

  async function onSubmit() {
    setError(null);
    setLoading(true);
    const res = await login(email, password, rememberMe);
    setLoading(false);

    if (!res.ok) { setError(res.error); return; }

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
    <View style={{ backgroundColor: Colors.bgApp }} className="flex-1 px-6 justify-center">
      <View className="rounded-2xl bg-white p-6 shadow-sm">
        <Text style={{ color: Colors.textPrimary }} className="text-2xl font-bold">Blue's Clues HRIS</Text>
        <Text style={{ color: Colors.textMuted }} className="mt-1 text-sm">Employee, Manager & HR Portal</Text>

        <View className="mt-6">
          <Text style={{ color: Colors.textSecondary }} className="text-sm font-semibold">Email / Username</Text>
          <TextInput
            value={email} onChangeText={setEmail}
            autoCapitalize="none" keyboardType="email-address"
            placeholder="Enter email or username"
            placeholderTextColor={Colors.textPlaceholder}
            style={{ borderColor: Colors.border, color: Colors.textPrimary }}
            className="mt-2 rounded-xl border bg-white px-4 py-3"
          />
        </View>

        <View className="mt-4">
          <Text style={{ color: Colors.textSecondary }} className="text-sm font-semibold">Password</Text>
          <TextInput
            value={password} onChangeText={setPassword}
            secureTextEntry placeholder="••••••••"
            placeholderTextColor={Colors.textPlaceholder}
            style={{ borderColor: Colors.border, color: Colors.textPrimary }}
            className="mt-2 rounded-xl border bg-white px-4 py-3"
          />
        </View>

        {error ? (
          <View style={{ backgroundColor: Colors.dangerLight }} className="mt-4 rounded-xl px-4 py-3">
            <Text style={{ color: Colors.dangerText }} className="text-sm font-semibold">{error}</Text>
          </View>
        ) : null}

        <View className="mt-4 flex-row items-center justify-between">
          <Pressable className="flex-row items-center" onPress={() => setRememberMe(v => !v)}>
            <View style={{
              backgroundColor: rememberMe ? Colors.primary : Colors.bgCard,
              borderColor: rememberMe ? Colors.primary : Colors.textPlaceholder,
            }} className="h-5 w-5 rounded border" />
            <Text style={{ color: Colors.textSecondary }} className="ml-2 text-sm">Remember Me</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate("ForgotPassword")}>
            <Text style={{ color: Colors.primary }} className="text-sm font-semibold">Forgot Password?</Text>
          </Pressable>
        </View>

        <Pressable
          style={{ backgroundColor: canSubmit ? Colors.primary : Colors.primaryDisabled }}
          className="mt-6 rounded-xl px-5 py-3"
          disabled={!canSubmit}
          onPress={onSubmit}
        >
          <Text className="text-center font-semibold text-white">
            {loading ? "Signing in..." : "Sign In →"}
          </Text>
        </Pressable>

        <View style={{ backgroundColor: Colors.border }} className="mt-6 h-[1px]" />

        <Pressable
          style={{ borderColor: Colors.border }}
          className="mt-4 rounded-xl border bg-white px-5 py-3"
          onPress={() => navigation.navigate("SignUp")}
        >
          <Text style={{ color: Colors.textPrimary }} className="text-center font-semibold">
            Go to Applicant Portal →
          </Text>
        </Pressable>
      </View>
    </View>
  );
};
