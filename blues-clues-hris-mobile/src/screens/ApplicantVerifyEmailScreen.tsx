import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { resendApplicantVerification, verifyApplicantEmail } from "../services/auth";
import { isValidEmail } from "../lib/utils";

export function ApplicantVerifyEmailScreen({ route, navigation }: any) {
  const initialEmail = route.params?.email ?? "";
  const source = route.params?.source ?? "signin";

  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canResend = useMemo(
    () => isValidEmail(email) && !resendLoading && !verifyLoading,
    [email, resendLoading, verifyLoading],
  );
  const canVerify = useMemo(
    () => token.trim().length > 0 && !verifyLoading && !resendLoading,
    [token, verifyLoading, resendLoading],
  );

  async function onResend() {
    if (!canResend) return;
    setError(null);
    setSuccess(null);
    setResendLoading(true);
    const res = await resendApplicantVerification(email.trim());
    setResendLoading(false);
    if (res.ok === false) {
      setError(res.error);
      return;
    }
    setSuccess(res.message);
  }

  async function onVerify() {
    if (!canVerify) return;
    setError(null);
    setSuccess(null);
    setVerifyLoading(true);
    const res = await verifyApplicantEmail(token.trim());
    setVerifyLoading(false);
    if (res.ok === false) {
      setError(res.error);
      return;
    }
    setSuccess(res.message);
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={["#0f172a", "#172554", "#134e4a"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <View style={styles.logoWrap}>
            <Ionicons name="mail-open-outline" size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.bannerTitle}>Verify your email</Text>
          <Text style={styles.bannerDesc}>
            {source === "signup"
              ? "Your applicant account was created. Check your inbox for the verification email before signing in."
              : "This applicant account still needs email verification before it can sign in."}
          </Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Resend verification email</Text>
          <Text style={styles.sectionDesc}>
            Enter the applicant email address and we&apos;ll send a fresh verification link.
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />

          <Pressable
            style={[styles.primaryBtn, !canResend && styles.primaryBtnDisabled]}
            disabled={!canResend}
            onPress={onResend}
          >
            {resendLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Resend Email</Text>
            )}
          </Pressable>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Verify with token</Text>
          <Text style={styles.sectionDesc}>
            If you opened the email in a browser, paste the `token` value from the verification link here.
          </Text>

          <TextInput
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Paste verification token"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />

          <Pressable
            style={[styles.secondaryBtn, !canVerify && styles.secondaryBtnDisabled]}
            disabled={!canVerify}
            onPress={onVerify}
          >
            {verifyLoading ? (
              <ActivityIndicator color="#1E3A8A" size="small" />
            ) : (
              <Text style={styles.secondaryBtnText}>Verify Email</Text>
            )}
          </Pressable>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {success ? <Text style={styles.successText}>{success}</Text> : null}

          <Pressable
            style={styles.backLink}
            onPress={() => navigation.replace("SignUp")}
          >
            <Text style={styles.backLinkText}>Back to Applicant Portal</Text>
          </Pressable>

          <Pressable
            style={styles.staffLink}
            onPress={() => navigation.replace("Login")}
          >
            <Text style={styles.staffLinkText}>Go to Employee Portal</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F1F5F9" },
  scroll: { flexGrow: 1 },
  banner: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 28,
  },
  logoWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  bannerTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 8,
  },
  bannerDesc: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: -16,
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 32,
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  sectionDesc: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  primaryBtn: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 14,
    backgroundColor: "#1E3A8A",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: {
    backgroundColor: "#93A8CC",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
  secondaryBtn: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "#1E3A8A",
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnDisabled: {
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
  },
  secondaryBtnText: {
    color: "#1E3A8A",
    fontWeight: "800",
    fontSize: 15,
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 20,
  },
  errorText: {
    marginTop: 12,
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "600",
  },
  successText: {
    marginTop: 12,
    color: "#15803D",
    fontSize: 13,
    fontWeight: "600",
  },
  backLink: {
    marginTop: 20,
    alignItems: "center",
  },
  backLinkText: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "700",
  },
  staffLink: {
    marginTop: 12,
    alignItems: "center",
  },
  staffLinkText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "700",
  },
});
