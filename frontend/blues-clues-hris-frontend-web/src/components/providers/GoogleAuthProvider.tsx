"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";

// Google OAuth Client ID is configured via NEXT_PUBLIC_GOOGLE_CLIENT_ID environment variable.
// Set up OAuth credentials at Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID
// Authorized origins: http://localhost:3000 (dev), https://yourdomain.com (prod)
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "YOUR_GOOGLE_CLIENT_ID";

export function GoogleAuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {children}
    </GoogleOAuthProvider>
  );
}
