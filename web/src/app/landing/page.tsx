"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LandingInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "done">("loading");
  const [message, setMessage] = useState<string>("");

  const playStoreUrl = "https://play.google.com/store/apps/details?id=com.edudashpro";

  const tryOpenApp = (pathAndQuery: string) => {
    const schemeUrl = `edudashpro://${pathAndQuery.replace(/^\//, "")}`;
    let didHide = false;
    const visibilityHandler = () => {
      if (document.hidden) didHide = true;
    };
    document.addEventListener("visibilitychange", visibilityHandler);
    window.location.replace(schemeUrl);
    setTimeout(() => {
      document.removeEventListener("visibilitychange", visibilityHandler);
      if (!didHide) {
        setStatus("error");
        setMessage("App not detected. Please install EduDash Pro to continue.");
      }
    }, 2000);
  };

  useEffect(() => {
    const run = async () => {
      try {
        const flow = (searchParams.get("flow") || searchParams.get("type") || "").toLowerCase();
        const tokenHash = searchParams.get("token_hash") || searchParams.get("token") || "";
        const inviteCode = searchParams.get("code") || searchParams.get("invitationCode") || "";

        // EMAIL CONFIRMATION
        if ((flow === "email-confirm" || searchParams.get("type") === "email") && tokenHash) {
          setMessage("Verifying your email...");
          try {
            const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
            if (error) throw error;
            setMessage("Email verified! Redirecting to dashboard...");
            setStatus("done");
            setTimeout(() => {
              router.push("/dashboard");
            }, 1000);
            return;
          } catch (e: any) {
            setStatus("error");
            setMessage(e?.message || "Email verification failed.");
            setTimeout(() => {
              tryOpenApp("(auth)/sign-in?emailVerificationFailed=true");
            }, 2000);
            return;
          }
        }

        // PARENT INVITE
        if (flow === "invite-parent" && inviteCode) {
          setMessage("Opening the app for parent registration...");
          setStatus("ready");
          tryOpenApp(`/screens/parent-registration?invitationCode=${encodeURIComponent(inviteCode)}`);
          return;
        }

        // STUDENT/MEMBER INVITE
        if ((flow === "invite-student" || flow === "invite-member") && inviteCode) {
          setMessage("Opening the app to join by code...");
          setStatus("ready");
          tryOpenApp(`/screens/student-join-by-code?code=${encodeURIComponent(inviteCode)}`);
          return;
        }

        // Default
        setMessage("Opening the app...");
        setStatus("ready");
        tryOpenApp("/");
      } catch (e: any) {
        setStatus("error");
        setMessage(e?.message || "Something went wrong.");
      }
    };
    run();
  }, [searchParams, router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 24, background: "#0a0a0f", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      {(status === "loading" || status === "done") && (
        <div style={{ width: 40, height: 40, border: "4px solid #00f5ff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      )}

      {message && (
        <p style={{ textAlign: "center", fontSize: 16, marginBottom: 8 }}>{message}</p>
      )}

      {status === "done" && (
        <p style={{ color: "#22c55e", textAlign: "center", fontSize: 14, marginTop: 8 }}>
          ✓ Opening app automatically...
        </p>
      )}

      {(status === "ready" || status === "error") && (
        <>
          <button
            onClick={() => {
              const path = searchParams.get("token_hash") ? "(auth)/sign-in?emailVerified=true" : "/";
              tryOpenApp(path);
            }}
            style={{ background: "#00f5ff", color: "#000", padding: "12px 24px", borderRadius: 8, border: 0, fontSize: 16, fontWeight: 800, cursor: "pointer", marginTop: 8 }}
          >
            Open EduDash Pro App
          </button>

          <div style={{ marginTop: 24, textAlign: "center" }}>
            <p style={{ color: "#9CA3AF", fontSize: 14, marginBottom: 8 }}>Don't have the app yet?</p>
            <a href={playStoreUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#00f5ff", textDecoration: "underline", fontSize: 14, fontWeight: 600 }}>
              Install from Google Play
            </a>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense>
      <LandingInner />
    </Suspense>
  );
}
