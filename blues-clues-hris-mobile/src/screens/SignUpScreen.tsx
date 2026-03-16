import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { applicantLogin, applicantRegister, saveSession } from "../services/auth";
import { isValidEmail } from "../lib/utils";
import { Colors } from "../constants/colors";

type Mode = "signin" | "signup";

export const SignUpScreen = ({ navigation }: any) => {
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);

  // Sign in fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  // Sign up fields
  const [fullName, setFullName] = useState("");
  const [email2, setEmail2] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  const canSignIn = useMemo(
    () => isValidEmail(email) && password.length > 0 && !loading,
    [email, password, loading],
  );

  const canSignUp = useMemo(
    () =>
      fullName.trim().length > 0 &&
      isValidEmail(email2) &&
      pw1.length >= 6 &&
      pw2.length > 0 &&
      pw1 === pw2 &&
      !loading,
    [fullName, email2, pw1, pw2, loading],
  );

  async function onSignIn() {
    setLoading(true);
    const res = await applicantLogin(email.trim(), password, rememberMe);
    setLoading(false);

    if (!res.ok) {
      Alert.alert("Sign In Failed", res.error);
      return;
    }

    await saveSession(res.user, rememberMe);
    navigation.replace("ApplicantDashboard", { session: res.user });
  }

  async function onCreateAccount() {
    setLoading(true);

    // Step 1: Register
    const regRes = await applicantRegister(fullName.trim(), email2.trim(), pw1);

    if (!regRes.ok) {
      setLoading(false);
      Alert.alert("Registration Failed", regRes.error);
      return;
    }

    // Step 2: Auto-login after registration
    const loginRes = await applicantLogin(email2.trim(), pw1, rememberMe);
    setLoading(false);

    if (!loginRes.ok) {
      // Account created but auto-login failed (e.g. email verification required)
      Alert.alert(
        "Account Created",
        "Your account was created. Please verify your email then sign in.",
        [{ text: "OK", onPress: () => { setMode("signin"); setEmail(email2.trim()); } }],
      );
      return;
    }

    await saveSession(loginRes.user, rememberMe);
    navigation.replace("ApplicantDashboard", { session: loginRes.user });
  }

  const inputStyle = { borderColor: Colors.border, color: Colors.textPrimary };

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
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800" }}>B</Text>
          </View>
          <Text style={{ color: Colors.textPrimary, fontSize: 13, fontWeight: "700", letterSpacing: 0.5 }}>Blue's Clues HRIS</Text>
        </View>

        <View style={{ borderRadius: 20, backgroundColor: "#FFFFFF", padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }}>
          <Text style={{ color: Colors.textPrimary, fontSize: 22, fontWeight: "800" }}>Applicant Portal</Text>
          <Text style={{ color: Colors.textMuted, marginTop: 4, fontSize: 13 }}>Start your journey with us today</Text>

          {/* Tabs */}
          <View style={{ backgroundColor: Colors.bgSubtle, marginTop: 18, flexDirection: "row", borderRadius: 12, padding: 4 }}>
            {(["signin", "signup"] as Mode[]).map((m) => (
              <Pressable
                key={m}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  paddingVertical: 10,
                  backgroundColor: mode === m ? "#FFFFFF" : "transparent",
                  shadowColor: mode === m ? "#000" : "transparent",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: mode === m ? 0.08 : 0,
                  shadowRadius: 4,
                  elevation: mode === m ? 2 : 0,
                }}
                onPress={() => setMode(m)}
              >
                <Text style={{ color: mode === m ? Colors.textPrimary : Colors.textMuted, textAlign: "center", fontWeight: "700", fontSize: 14 }}>
                  {m === "signin" ? "Sign In" : "Sign Up"}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === "signin" ? (
            <>
              <View style={{ marginTop: 18 }}>
                <Text style={{ color: Colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.textPlaceholder}
                  style={[inputStyle, { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 }]}
                />
              </View>

              <View style={{ marginTop: 14 }}>
                <Text style={{ color: Colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textPlaceholder}
                  style={[inputStyle, { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 }]}
                />
              </View>

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
                  <Text style={{ color: Colors.textSecondary, marginLeft: 8, fontSize: 13 }}>Remember me</Text>
                </Pressable>
                <Pressable onPress={() => navigation.navigate("ForgotPassword")}>
                  <Text style={{ color: Colors.primary, fontSize: 13, fontWeight: "700" }}>Forgot password?</Text>
                </Pressable>
              </View>

              <Pressable
                style={{
                  marginTop: 18,
                  borderRadius: 12,
                  paddingVertical: 14,
                  backgroundColor: canSignIn ? Colors.primary : Colors.primaryDisabled,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                }}
                disabled={!canSignIn}
                onPress={onSignIn}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 15 }}>Sign In →</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <View style={{ marginTop: 18 }}>
                <Text style={{ color: Colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Full Name</Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Juan dela Cruz"
                  placeholderTextColor={Colors.textPlaceholder}
                  style={[inputStyle, { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 }]}
                />
              </View>

              <View style={{ marginTop: 14 }}>
                <Text style={{ color: Colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Email Address</Text>
                <TextInput
                  value={email2}
                  onChangeText={setEmail2}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.textPlaceholder}
                  style={[inputStyle, { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 }]}
                />
              </View>

              <View style={{ marginTop: 14 }}>
                <Text style={{ color: Colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Password</Text>
                <TextInput
                  value={pw1}
                  onChangeText={setPw1}
                  secureTextEntry
                  placeholder="Min. 6 characters"
                  placeholderTextColor={Colors.textPlaceholder}
                  style={[inputStyle, { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 }]}
                />
              </View>

              <View style={{ marginTop: 14 }}>
                <Text style={{ color: Colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Confirm Password</Text>
                <TextInput
                  value={pw2}
                  onChangeText={setPw2}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textPlaceholder}
                  style={[inputStyle, { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderColor: pw1 && pw2 && pw1 !== pw2 ? Colors.danger : Colors.border }]}
                />
                {pw1 && pw2 && pw1 !== pw2 ? (
                  <Text style={{ color: Colors.dangerText, marginTop: 6, fontSize: 12 }}>Passwords do not match.</Text>
                ) : null}
              </View>

              <Pressable
                style={{
                  marginTop: 18,
                  borderRadius: 12,
                  paddingVertical: 14,
                  backgroundColor: canSignUp ? Colors.primary : Colors.primaryDisabled,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                }}
                disabled={!canSignUp}
                onPress={onCreateAccount}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 15 }}>Create Account →</Text>
                )}
              </Pressable>

              <View style={{ backgroundColor: Colors.primaryLight, marginTop: 18, borderRadius: 12, padding: 14 }}>
                <Text style={{ color: Colors.primary, fontWeight: "700", fontSize: 13 }}>Did you know?</Text>
                <Text style={{ color: Colors.primary, marginTop: 4, fontSize: 12, lineHeight: 18 }}>
                  Fresh graduates can connect via the Pillars System, and Alumni can use the Alumni Portal for streamlined processing.
                </Text>
              </View>
            </>
          )}
        </View>

        <View style={{ height: 1, backgroundColor: Colors.border, marginTop: 24, marginBottom: 16 }} />
        <Pressable style={{ alignItems: "center" }} onPress={() => navigation.replace("Login")}>
          <Text style={{ color: Colors.textMuted, fontSize: 13, fontWeight: "700" }}>← Return to Employee Portal</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
