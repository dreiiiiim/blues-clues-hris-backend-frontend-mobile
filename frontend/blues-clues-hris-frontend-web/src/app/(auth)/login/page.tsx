"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginApi, authFetch, refreshApi } from "@/lib/authApi";
import { setTokens, saveUserInfo, parseJwt, clearAuthStorage, getRememberMe, getUserInfo } from "@/lib/authStorage";
import { API_BASE_URL } from "@/lib/api";
import { roleToPath } from "@/lib/roleMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { GoogleSignInButton } from "@/components/ui/google-sign-in-button";
// TODO (Sprint 2): swap GoogleSignInButton for GoogleLogin once Client ID is available
// import { GoogleLogin } from "@react-oauth/google";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { User, AlertCircle, Loader2 } from "lucide-react";

export default function EmployeeLoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getRememberMe()) return;
    const userInfo = getUserInfo();
    if (!userInfo || userInfo.role === "applicant") return;

    refreshApi()
      .then(() => router.replace(`/${userInfo.role}`))
      .catch(() => clearAuthStorage()); // cookie expired — stay on login
  }, [router]);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { access_token } = await loginApi({
        identifier,
        password,
        rememberMe,
      });

      setTokens({ access_token, rememberMe });

      const payload = parseJwt(access_token);
      if (!payload) throw new Error("Invalid token received from server.");

      const rolePath = roleToPath(payload.role_name);
      if (rolePath === "/login") throw new Error(`Unknown role: ${payload.role_name}`);

      const role = rolePath.replace("/", "");

      if (role === "applicant") {
        setError("Applicants must use the Candidate Portal.");
        setIsLoading(false);
        return;
      }

      const meRes = await authFetch(`${API_BASE_URL}/me`);
      const me = await meRes.json().catch(() => ({}));

      const firstName = payload.first_name ?? "";
      const lastName = payload.last_name ?? "";
      const name = [firstName, lastName].filter(Boolean).join(" ") || me.username || identifier;

      saveUserInfo({ name, email: me.email ?? "", role });
      router.push(`/${role}`);
    } catch (err: any) {
      setError(err?.message || "Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // TODO (Sprint 2 - Frontend): wire credentialResponse.credential to googleLoginApi()
  // in src/lib/authApi.ts once backend endpoint POST /api/tribeX/auth/v1/auth/google is ready.
  // credentialResponse.credential is the Google ID token — pass it directly to googleLoginApi().
  // On success, follow same post-login flow as handleLogin():
  // setTokens() → parseJwt() → saveUserInfo() → router.push()
  const handleGoogleSignIn = (_credentialResponse: any) => {
    setError("Google sign-in is not enabled yet in this environment.");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_45%,#ecfeff_100%)] p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.04),transparent_45%)]" />
      </div>

      <Card className="relative w-full max-w-md border-border/70 bg-card/90 shadow-xl backdrop-blur-sm">
        <CardHeader className="text-center pb-6">
          <div className="flex flex-col items-center mb-4">
            <span className="text-xl font-bold tracking-tight text-primary">
              Blue's Clues
            </span>
            <span className="text-sm font-bold text-primary mt-1">
              HR Information Systems
            </span>
          </div>
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription>Please sign in to your staff account</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Google SSO Button */}
          {/* TODO (Sprint 2): replace GoogleSignInButton with GoogleLogin once Client ID is available */}
          {/* <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSignIn}
              onError={() => setError("Google sign-in failed. Please try again.")}
              useOneTap={false}
              text="signin_with_google"
              shape="rectangular"
              size="large"
              width="368"
            />
          </div> */}
          <GoogleSignInButton disabled={isLoading} onClick={() => setError("Google sign-in is not enabled yet in this environment.")} />

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              or
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Email or Username</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Email or username"
                  className="pl-9"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Password</label>
              <PasswordInput
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="flex items-center justify-between text-sm py-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-muted-foreground font-medium">Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-primary hover:underline font-semibold">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                "Sign In →"
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col items-center gap-3 pt-6 border-t border-border bg-muted/30 rounded-b-xl">
          <Link
            href="/applicant/login"
            className="text-primary font-bold hover:underline text-[10px] uppercase tracking-widest"
          >
            Applicant Portal →
          </Link>
          <Link
            href="/subscribe"
            className="text-muted-foreground hover:text-primary hover:underline text-xs"
          >
            New Company? Subscribe Now
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
