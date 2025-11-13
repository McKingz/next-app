"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function TeacherSignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validation
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    const supabase = createClient();

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'teacher',
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }
    });

    if (authError) {
      setLoading(false);
      setError(authError.message);
      return;
    }

    if (!authData.user) {
      setLoading(false);
      setError("Failed to create account. Please try again.");
      return;
    }

    // Create user profile in database (profiles-first architecture)
    // Note: This should be handled by auth.users trigger or separate profile creation
    // For now, profile is created automatically by Supabase auth trigger
    // If additional data is needed, update profiles table:
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        role: 'teacher',
        // phone_number not in profiles schema - may need to add if required
      })
      .eq('id', authData.user.id);

    setLoading(false);

    if (profileError) {
      setError("Account created but profile setup failed. Please contact support.");
      console.error("Profile creation error:", profileError);
      return;
    }

    // Success - redirect to email verification notice
    router.push('/sign-up/verify-email');
  }

  return (
    <>
      <style jsx global>{`
        body {
          overflow-x: hidden;
          max-width: 100vw;
        }
      `}</style>
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0f", fontFamily: "system-ui, sans-serif", overflowX: "hidden", padding: "20px 0" }}>
        <div style={{ width: "100%", maxWidth: "100vw", background: "#111113", padding: "40px 5%", border: "1px solid #1f1f23", boxSizing: "border-box" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ width: 64, height: 64, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 32 }}>
              🎓
            </div>
            <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Teacher Sign Up</h1>
            <p style={{ color: "#9CA3AF", fontSize: 14 }}>Create your teacher account and join a preschool</p>
          </div>

          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 500, margin: "0 auto" }}>
            <div>
              <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Full Name *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Jane Smith"
                style={{ width: "100%", padding: "12px 14px", background: "#1a1a1f", border: "1px solid #2a2a2f", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{ width: "100%", padding: "12px 14px", background: "#1a1a1f", border: "1px solid #2a2a2f", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Phone Number (Optional)</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+27 82 123 4567"
                style={{ width: "100%", padding: "12px 14px", background: "#1a1a1f", border: "1px solid #2a2a2f", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>School/Preschool Name (Optional)</label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Sunshine Preschool"
                style={{ width: "100%", padding: "12px 14px", background: "#1a1a1f", border: "1px solid #2a2a2f", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box" }}
              />
              <p style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>Your principal will invite you to join your school</p>
            </div>

            <div>
              <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Password *</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="At least 8 characters"
                  style={{ width: "100%", padding: "12px 14px", background: "#1a1a1f", border: "1px solid #2a2a2f", borderRadius: 8, color: "#fff", fontSize: 14, paddingRight: 40, boxSizing: "border-box" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: 0, color: "#9CA3AF", cursor: "pointer", fontSize: 18 }}
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: "block", color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Confirm Password *</label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Re-enter password"
                style={{ width: "100%", padding: "12px 14px", background: "#1a1a1f", border: "1px solid #2a2a2f", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box" }}
              />
            </div>

            {error && (
              <div style={{ padding: 12, background: "#7f1d1d", border: "1px solid #991b1b", borderRadius: 8 }}>
                <p style={{ color: "#fca5a5", fontSize: 14, margin: 0 }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px 16px",
                background: loading ? "#555" : "linear-gradient(135deg, #00f5ff 0%, #0088cc 100%)",
                color: "#000",
                border: 0,
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Creating Account..." : "Create Teacher Account"}
            </button>

            <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, margin: 0 }}>
              By signing up, you agree to our <Link href="/terms" style={{ color: "#00f5ff" }}>Terms</Link> and <Link href="/privacy" style={{ color: "#00f5ff" }}>Privacy Policy</Link>
            </p>
          </form>

          <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid #2a2a2f", textAlign: "center" }}>
            <p style={{ color: "#9CA3AF", fontSize: 14 }}>
              Already have an account? <Link href="/sign-in" style={{ color: "#00f5ff", fontWeight: 600, textDecoration: "underline" }}>Sign In</Link>
            </p>
            <p style={{ color: "#9CA3AF", fontSize: 14, marginTop: 12 }}>
              Are you a parent? <Link href="/sign-up/parent" style={{ color: "#00f5ff", fontWeight: 600, textDecoration: "underline" }}>Sign up as Parent</Link>
            </p>
          </div>

          <div style={{ marginTop: 24, textAlign: "center" }}>
            <Link href="/" style={{ color: "#00f5ff", fontSize: 14, textDecoration: "none" }}>
              ← Go to Home
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
