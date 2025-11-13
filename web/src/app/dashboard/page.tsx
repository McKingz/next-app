"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      
      if (!active) return;
      
      if (!session) {
        router.replace("/sign-in");
        return;
      }

      // Get user profile to determine role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      const role = profile?.role || 'parent';

      // Redirect to appropriate dashboard based on role
      switch (role) {
        case 'parent':
          router.replace('/dashboard/parent');
          break;
        case 'teacher':
          router.replace('/dashboard/teacher');
          break;
        case 'principal':
          router.replace('/dashboard/principal');
          break;
        case 'superadmin':
          router.replace('/dashboard/superadmin');
          break;
        default:
          router.replace('/dashboard/parent'); // Default to parent dashboard
      }
    })();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  return (
    <main style={{ 
      padding: 24, 
      fontFamily: "system-ui, sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh"
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ 
          width: 40, 
          height: 40, 
          border: "4px solid #e0e0e0", 
          borderTopColor: "#3b82f6",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
          margin: "0 auto 16px"
        }} />
        <p style={{ color: "#666" }}>Redirecting to your dashboard...</p>
      </div>
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}