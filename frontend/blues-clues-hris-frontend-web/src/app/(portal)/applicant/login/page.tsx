"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginApi, authFetch } from "@/lib/authApi";
import { setTokens, saveUserInfo, parseJwt, getAccessToken, getUserInfo } from "@/lib/authStorage";
import { API_BASE_URL } from "@/lib/api";
import { roleToPath } from "@/lib/roleMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { GoogleSignInButton } from "@/components/ui/google-sign-in-button";
// TODO (Sprint 2): swap GoogleSignInButton for GoogleLogin once Client ID is available
// import { GoogleLogin } from "@react-oauth/google";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Briefcase, TrendingUp, AlertCircle, Loader2 } from "lucide-react";

export default function ApplicantPortalAuth() {
  const router = useRouter();

  useEffect(() => {
    const token = getAccessToken();
    const userInfo = getUserInfo();
    if (token && userInfo && userInfo.role === "applicant") {
      router.replace("/applicant/dashboard");
    }
  }, [router]);

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { access_token } = await loginApi({
        identifier: email,
        password,
        rememberMe: false,
      });

      setTokens({ access_token, rememberMe: false });

      const payload = parseJwt(access_token);
      if (!payload) throw new Error("Invalid token received from server.");

      const role = roleToPath(payload.role_name).replace("/", "");

      if (role !== "applicant") {
        setError("Staff accounts must use the Internal Login portal.");
        setIsLoading(false);
        return;
      }

      const meRes = await authFetch(`${API_BASE_URL}/me`);
      const me = await meRes.json().catch(() => ({}));

      const firstName = payload.first_name ?? "";
      const lastName = payload.last_name ?? "";
      const name = [firstName, lastName].filter(Boolean).join(" ") || me.username || email;

      saveUserInfo({ name, email: me.email ?? email, role: "applicant" });

      // Hard redirect to refresh layout and show Sidebar
      window.location.href = "/applicant/dashboard";
    } catch (err: any) {
      setError(err?.message || "Invalid credentials. Please try again.");
      setIsLoading(false);
    }
  };

  // TODO (Sprint 2 - Frontend): wire credentialResponse.credential to googleLoginApi()
  // once backend endpoint POST /api/tribeX/auth/v1/auth/google is ready.
  const handleGoogleSignIn = (credentialResponse: any) => {
    // TODO: googleLoginApi(credentialResponse.credential)
  };

  return (
    <div className="flex min-h-screen bg-muted/10 animate-in fade-in duration-500">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col w-1/2 bg-primary/5 p-16 border-r border-border relative">
        <div className="mb-auto relative z-10">
          <h1 className="text-5xl font-bold mb-6 tracking-tighter leading-tight">Join our<br />growing team.</h1>
          <p className="text-muted-foreground mb-12 max-w-sm text-lg leading-relaxed">
            Discover opportunities that match your skills and take the next step in your professional journey.
          </p>
          <div className="space-y-10">
            <FeatureItem icon={Search}    title="Explore Roles"      desc="Find the perfect fit for your expertise in our open positions." />
            <FeatureItem icon={Briefcase} title="Track Application"  desc="Get real-time updates and notifications on your status." />
            <FeatureItem icon={TrendingUp} title="Grow With Us"      desc="Develop your career in a dynamic, forward-thinking environment." />
          </div>
        </div>
        <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest relative z-10">
          © 2026 HR Information Systems Portal
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-card/30">
        <div className="w-full max-w-md space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-5xl font-bold tracking-tight">Applicant Portal</h2>
            <p className="text-lg text-muted-foreground">
              {isSignUp ? "Create your candidate profile" : "Welcome back, please sign in"}
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium p-4 rounded-xl flex items-center gap-3">
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
          <GoogleSignInButton disabled={isLoading} onClick={() => {}} />

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              or
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Sign In / Sign Up tabs */}
          <div className="flex p-1 bg-muted/60 rounded-xl border border-border">
            <button
              type="button"
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${!isSignUp ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => { setIsSignUp(false); setError(""); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${isSignUp ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => { setIsSignUp(true); setError(""); }}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            {isSignUp && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Full Name</label>
                <Input type="text" placeholder="John Doe" className="h-11 bg-background" required />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Email Address</label>
              <Input
                type="email"
                placeholder="name@company.com"
                className="h-11 bg-background"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Security Password</label>
              <PasswordInput
                placeholder="••••••••"
                className="h-11 bg-background"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg mt-2"
              disabled={isLoading}
            >
              {isLoading
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : (isSignUp ? "Create Account →" : "Sign In to Portal →")
              }
            </Button>
          </form>

          <div className="text-center pt-4">
            <Link href="/login">
              <Button variant="ghost" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all">
                ← Internal Staff Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ icon: Icon, title, desc }: any) {
  return (
    <div className="flex gap-5 group">
      <div className="bg-primary/10 p-3.5 rounded-2xl h-fit border border-primary/5 transition-transform group-hover:scale-110">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <div className="space-y-1">
        <h3 className="font-bold text-foreground leading-none">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{desc}</p>
      </div>
    </div>
  );
}
