"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft } from "lucide-react";

type UserType = "parents" | "schools";

export default function PricingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userType, setUserType] = useState<UserType>("parents");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isOnTrial, setIsOnTrial] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndTrial = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);

      if (session) {
        try {
          const { data: trialData } = await supabase.rpc('get_my_trial_status');
          setIsOnTrial(trialData?.is_trial || false);
        } catch (err) {
          console.debug('Trial check failed:', err);
        }
      }
      setLoading(false);
    };
    checkAuthAndTrial();
  }, [supabase]);

  const parentPlans = [
    {
      name: "Free",
      price: 0,
      priceAnnual: 0,
      popular: false,
      features: [
        "10 AI queries/month",
        "Basic homework help",
        "Child progress tracking",
        "Teacher messaging",
        "Email support"
      ]
    },
    {
      name: "Parent Starter",
      price: 49.99,
      priceAnnual: 479.90,
      popular: true,
      features: [
        "30 Homework Helper/month",
        "AI lesson support",
        "Child-safe explanations",
        "Progress tracking",
        "Email support",
        ...(isOnTrial ? [] : ["7-day free trial"])
      ]
    },
    {
      name: "Parent Plus",
      price: 149.99,
      priceAnnual: 1439.90,
      popular: false,
      features: [
        "100 Homework Helper/month",
        "Priority processing",
        "Up to 3 children",
        "Advanced learning insights",
        "Priority support",
        "WhatsApp Connect",
        "Learning Resources",
        "Progress Analytics"
      ]
    }
  ];

  const schoolPlans = [
    {
      name: "Free Plan",
      price: 0,
      priceAnnual: 0,
      popular: false,
      features: [
        "Basic dashboard",
        "Student management",
        "Parent communication",
        "Basic reporting"
      ]
    },
    {
      name: "Starter Plan",
      price: 299,
      priceAnnual: 2990,
      popular: true,
      features: [
        "Essential features",
        "AI-powered insights",
        "Parent portal",
        "WhatsApp notifications",
        "Email support",
        ...(isOnTrial ? [] : ["7-day free trial"])
      ]
    },
    {
      name: "Premium Plan",
      price: 599,
      priceAnnual: 5990,
      popular: false,
      features: [
        "All Starter features",
        "Advanced reporting",
        "Priority support",
        "Custom branding",
        "API access",
        "Advanced analytics"
      ]
    },
    {
      name: "Enterprise Plan",
      price: null,
      priceAnnual: null,
      popular: false,
      features: [
        "All Premium features",
        "Unlimited users",
        "Dedicated success manager",
        "SLA guarantee",
        "White-label solution",
        "Custom integrations",
        "24/7 priority support"
      ]
    }
  ];

  const activePlans = userType === "parents" ? parentPlans : schoolPlans;

  return (
    <>
      <style jsx global>{`
        body {
          overflow-x: hidden;
          max-width: 100vw;
        }
      `}</style>
      <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        {/* Header */}
        <header style={{ position: "sticky", top: 0, zIndex: 1000, background: "rgba(10, 10, 15, 0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Link href="/" style={{ fontSize: "18px", fontWeight: 700, textDecoration: "none", color: "#fff" }}>🎓 EduDash Pro</Link>
            {isLoggedIn ? (
              <button
                onClick={() => router.push('/dashboard/parent')}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  color: "#00f5ff",
                  background: "transparent",
                  border: "1px solid #00f5ff",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                <ArrowLeft size={16} />
                Back to Dashboard
              </button>
            ) : (
              <Link href="/sign-in" style={{ color: "#00f5ff", textDecoration: "none", fontSize: "14px", fontWeight: 600 }}>Sign In</Link>
            )}
          </div>
        </header>

        {/* Hero */}
        <section style={{ paddingTop: "60px", paddingBottom: "40px", textAlign: "center", maxWidth: "900px", margin: "0 auto", padding: "60px 20px 40px" }}>
          <div style={{ marginBottom: "16px" }}>
            <span style={{ display: "inline-block", padding: "6px 16px", background: "rgba(0, 245, 255, 0.1)", border: "1px solid rgba(0, 245, 255, 0.3)", borderRadius: "20px", fontSize: "12px", color: "#00f5ff", fontWeight: 600 }}>🇿🇦 South African Pricing</span>
          </div>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 800, marginBottom: "16px" }}>Choose Your Perfect Plan</h1>
          <p style={{ fontSize: "18px", color: "#9CA3AF", maxWidth: "600px", margin: "0 auto" }}>
            Transparent pricing for parents and schools across South Africa
          </p>
          
          {!isOnTrial && (
            <div style={{ marginTop: "32px", marginBottom: "24px", display: "inline-block", background: "rgba(251, 191, 36, 0.15)", border: "2px solid #fbbf24", borderRadius: "12px", padding: "12px 24px" }}>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.05em" }}>🎉 7-Day Free Trial • No Credit Card Required</p>
            </div>
          )}
        </section>

        {/* User Type Toggle */}
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 20px 40px" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "32px" }}>
            <button
              onClick={() => setUserType("parents")}
              style={{
                padding: "12px 32px",
                background: userType === "parents" ? "linear-gradient(135deg, #00f5ff 0%, #0080ff 100%)" : "rgba(255, 255, 255, 0.05)",
                color: userType === "parents" ? "#0a0a0f" : "#9CA3AF",
                border: userType === "parents" ? "2px solid #00f5ff" : "2px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                fontSize: "16px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              👨‍👩‍👧 For Parents
            </button>
            <button
              onClick={() => setUserType("schools")}
              style={{
                padding: "12px 32px",
                background: userType === "schools" ? "linear-gradient(135deg, #00f5ff 0%, #0080ff 100%)" : "rgba(255, 255, 255, 0.05)",
                color: userType === "schools" ? "#0a0a0f" : "#9CA3AF",
                border: userType === "schools" ? "2px solid #00f5ff" : "2px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                fontSize: "16px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              🏫 For Schools
            </button>
          </div>

          {/* Billing Period Toggle */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", marginBottom: "48px" }}>
            <span style={{ color: billingPeriod === "monthly" ? "#fff" : "#6B7280", fontWeight: 600 }}>Monthly</span>
            <button
              onClick={() => setBillingPeriod(billingPeriod === "monthly" ? "annual" : "monthly")}
              style={{
                width: "56px",
                height: "28px",
                background: billingPeriod === "annual" ? "#00f5ff" : "rgba(255, 255, 255, 0.2)",
                border: "none",
                borderRadius: "14px",
                position: "relative",
                cursor: "pointer",
                transition: "all 0.3s"
              }}
            >
              <div style={{
                width: "20px",
                height: "20px",
                background: "#fff",
                borderRadius: "50%",
                position: "absolute",
                top: "4px",
                left: billingPeriod === "annual" ? "32px" : "4px",
                transition: "all 0.3s"
              }} />
            </button>
            <span style={{ color: billingPeriod === "annual" ? "#fff" : "#6B7280", fontWeight: 600 }}>Annual <span style={{ color: "#22c55e", fontSize: "12px" }}>(Save 20%)</span></span>
          </div>

          {/* Pricing Cards */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", 
            gap: "24px",
            maxWidth: userType === "schools" && schoolPlans.length === 4 ? "1200px" : "900px",
            margin: "0 auto"
          }}>
            {activePlans.map((plan) => {
              const price = billingPeriod === "annual" ? plan.priceAnnual : plan.price;
              const isEnterprise = plan.price === null;
              
              return (
                <div
                  key={plan.name}
                  style={{
                    background: plan.popular ? "linear-gradient(135deg, #00f5ff 0%, #0080ff 100%)" : "#111113",
                    border: plan.popular ? "none" : "1px solid #1f1f23",
                    borderRadius: "16px",
                    padding: "32px 24px",
                    position: "relative",
                    textAlign: "center"
                  }}
                >
                  {plan.popular && (
                    <div style={{ position: "absolute", top: "-12px", right: "24px", background: "#22c55e", color: "#fff", padding: "4px 12px", borderRadius: "12px", fontSize: "11px", fontWeight: 700 }}>
                      MOST POPULAR
                    </div>
                  )}
                  
                  <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "16px", color: plan.popular ? "#0a0a0f" : "#fff" }}>
                    {plan.name}
                  </h3>
                  
                  <div style={{ marginBottom: "24px" }}>
                    {isEnterprise ? (
                      <>
                        <div style={{ fontSize: "36px", fontWeight: 800, color: plan.popular ? "#0a0a0f" : "#fff" }}>Custom</div>
                        <div style={{ fontSize: "14px", color: plan.popular ? "rgba(10, 10, 15, 0.7)" : "#6B7280" }}>Contact us for pricing</div>
                      </>
                    ) : price === 0 ? (
                      <>
                        <div style={{ fontSize: "48px", fontWeight: 800, color: plan.popular ? "#0a0a0f" : "#fff" }}>Free</div>
                        <div style={{ fontSize: "14px", color: plan.popular ? "rgba(10, 10, 15, 0.7)" : "#6B7280" }}>Forever</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: "48px", fontWeight: 800, color: plan.popular ? "#0a0a0f" : "#fff" }}>
                          R{typeof price === "number" ? price.toFixed(price % 1 === 0 ? 0 : 2) : "0"}
                        </div>
                        <div style={{ fontSize: "14px", color: plan.popular ? "rgba(10, 10, 15, 0.7)" : "#6B7280" }}>
                          per {billingPeriod === "annual" ? "year" : "month"}
                        </div>
                      </>
                    )}
                  </div>

                  <ul style={{ listStyle: "none", padding: 0, marginBottom: "32px", textAlign: "left" }}>
                    {plan.features.map((feature, i) => (
                      <li key={i} style={{ 
                        marginBottom: "12px", 
                        display: "flex", 
                        alignItems: "flex-start", 
                        gap: "8px",
                        color: plan.popular ? "rgba(10, 10, 15, 0.9)" : "#D1D5DB",
                        fontSize: "14px",
                        lineHeight: 1.6
                      }}>
                        <span style={{ color: plan.popular ? "#0a0a0f" : "#00f5ff", fontSize: "16px" }}>✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Link 
                    href="/sign-in"
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "14px",
                      background: plan.popular ? "#0a0a0f" : "linear-gradient(135deg, #00f5ff 0%, #0080ff 100%)",
                      color: plan.popular ? "#fff" : "#0a0a0f",
                      border: "none",
                      borderRadius: "10px",
                      fontSize: "16px",
                      fontWeight: 700,
                      cursor: "pointer",
                      textDecoration: "none",
                      textAlign: "center"
                    }}
                  >
                    {isEnterprise ? "Contact Sales" : price === 0 ? "Get Started Free" : "Start Free Trial"}
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Trust Badges */}
          <div style={{ marginTop: "64px", textAlign: "center", padding: "32px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "16px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
            <p style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px", color: "#fff" }}>✅ Why Choose EduDash Pro?</p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "32px", fontSize: "14px", color: "#9CA3AF" }}>
              <span>🔒 Multi-tenant security</span>
              <span>🇿🇦 Built for South Africa</span>
              <span>💳 No credit card required</span>
              <span>⭐ Cancel anytime</span>
              <span>🚀 Instant setup</span>
            </div>
          </div>

          {/* FAQ Preview */}
          <div style={{ marginTop: "64px", maxWidth: "800px", margin: "64px auto 0" }}>
            <h2 style={{ fontSize: "32px", fontWeight: 800, textAlign: "center", marginBottom: "32px" }}>Frequently Asked Questions</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <details style={{ background: "rgba(255, 255, 255, 0.02)", padding: "20px", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                <summary style={{ fontSize: "16px", fontWeight: 700, cursor: "pointer" }}>Can I switch plans later?</summary>
                <p style={{ marginTop: "12px", color: "#9CA3AF", fontSize: "14px", lineHeight: 1.6 }}>
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
                </p>
              </details>
              <details style={{ background: "rgba(255, 255, 255, 0.02)", padding: "20px", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                <summary style={{ fontSize: "16px", fontWeight: 700, cursor: "pointer" }}>What payment methods do you accept?</summary>
                <p style={{ marginTop: "12px", color: "#9CA3AF", fontSize: "14px", lineHeight: 1.6 }}>
                  We accept all major credit/debit cards, EFT, and SnapScan. All payments are processed securely.
                </p>
              </details>
              <details style={{ background: "rgba(255, 255, 255, 0.02)", padding: "20px", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                <summary style={{ fontSize: "16px", fontWeight: 700, cursor: "pointer" }}>Is my data safe?</summary>
                <p style={{ marginTop: "12px", color: "#9CA3AF", fontSize: "14px", lineHeight: 1.6 }}>
                  Absolutely. We comply with POPIA and use bank-level encryption. Your data is hosted securely in South Africa.
                </p>
              </details>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <section style={{ marginTop: "80px", padding: "80px 20px", background: "linear-gradient(135deg, #00f5ff 0%, #0080ff 100%)", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, marginBottom: "16px", color: "#0a0a0f" }}>Ready to Get Started?</h2>
          <p style={{ fontSize: "18px", marginBottom: "32px", color: "rgba(10,10,15,.75)", maxWidth: "600px", margin: "0 auto 32px" }}>
            Join hundreds of South African families and schools using EduDash Pro
          </p>
          <Link href="/sign-in" style={{ display: "inline-block", padding: "16px 32px", background: "#0a0a0f", color: "#fff", borderRadius: "12px", fontSize: "16px", fontWeight: 700, textDecoration: "none" }}>
            Start Your 7-Day Free Trial →
          </Link>
        </section>

        {/* Footer */}
        <footer style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)", padding: "32px 20px", textAlign: "center" }}>
          <p style={{ color: "#6B7280", fontSize: "14px" }}>© 2025 EduDash Pro. All rights reserved.</p>
        </footer>
      </div>
    </>
  );
}
