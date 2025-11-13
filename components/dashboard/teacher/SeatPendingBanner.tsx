/**
 * Seat Pending Banner Component
 */

import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { assertSupabase } from '@/lib/supabase';

interface SeatPendingBannerProps {
  seatStatus: string;
  user: any;
  refresh: () => void;
}

export const SeatPendingBanner: React.FC<SeatPendingBannerProps> = ({
  seatStatus,
  user,
  refresh,
}) => {
  return (
    <View
      style={{
        backgroundColor: "#FEF3C7",
        borderColor: "#FCD34D",
        borderWidth: 1,
        padding: 10,
        borderRadius: 10,
        marginBottom: 12,
      }}
    >
      <Text style={{ color: "#92400E", fontWeight: "700" }}>
        {seatStatus === "pending"
          ? "Access Restricted - Seat Pending"
          : "Access Restricted - No Active Seat"}
      </Text>
      <Text style={{ color: "#92400E" }}>
        {seatStatus === "pending"
          ? "Your teacher seat is pending approval. Ask your administrator to assign a seat."
          : "Your teacher account needs an active seat to access all features. Request a seat from your administrator."}
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <TouchableOpacity
          style={{
            backgroundColor: "#FDE68A",
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
          }}
          onPress={() => router.push("/screens/account")}
        >
          <Text style={{ color: "#92400E", fontWeight: "700" }}>Account</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            backgroundColor: "#FDE68A",
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
          }}
          onPress={() => refresh()}
        >
          <Text style={{ color: "#92400E", fontWeight: "700" }}>Refresh</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            backgroundColor: "#FDE68A",
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
          }}
          onPress={async () => {
            try {
              const { data: userRes } = await assertSupabase().auth.getUser();
              const uid = userRes?.user?.id;
              if (!uid) return;
              const { data: prof } = await assertSupabase()
                .from("profiles")
                .select("preschool_id,email,organization_id")
                .eq("id", uid)
                .maybeSingle();
              const orgId = (prof as any)?.preschool_id || (prof as any)?.organization_id;
              const email = (prof as any)?.email || user?.email;
              if (orgId) {
                const { notifySeatRequestCreated } = await import("@/lib/notify");
                await notifySeatRequestCreated(orgId, email);
                Alert.alert("Request Sent", "Your administrator has been notified.");
              } else {
                Alert.alert("Unavailable", "Could not determine your school.");
              }
            } catch (e: any) {
              Alert.alert("Failed", e?.message || "Could not send request");
            }
          }}
        >
          <Text style={{ color: "#92400E", fontWeight: "700" }}>Request Seat</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
