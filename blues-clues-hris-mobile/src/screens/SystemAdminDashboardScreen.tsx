import React from "react";
import { View, Text, Pressable } from "react-native";
import { clearSession } from "../services/auth";

export const SystemAdminDashboardScreen = ({ navigation }: any) => {
  async function handleLogout() {
    await clearSession();
    navigation.replace("Login");
  }

  return (
    <View className="flex-1 items-center justify-center bg-[#eff6ff]">
      <Text className="text-[#111827] text-xl font-bold mb-6">System Admin Dashboard or Admin</Text>

      <Pressable
        onPress={handleLogout}
        className="rounded-xl bg-red-500 px-6 py-3"
      >
        <Text className="text-black font-semibold text-base">Log Out</Text>
      </Pressable>
    </View>
  );
};
