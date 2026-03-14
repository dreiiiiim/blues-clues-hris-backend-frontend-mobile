import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, SafeAreaView, StatusBar, useWindowDimensions, Pressable } from "react-native";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { Header } from "../components/Header";
import { Colors } from "../constants/colors";
import { UserSession } from "../services/auth";

type ChecklistItem = {
  id: string;
  title: string;
  locked: boolean;
  completed: boolean;
};

const INITIAL_CHECKLIST: ChecklistItem[] = [
  { id: "id_docs", title: "Upload identification documents", locked: false, completed: false },
  { id: "handbook", title: "Review employee handbook", locked: false, completed: false },
  { id: "tax", title: "Complete tax forms", locked: false, completed: false },
  { id: "deposit", title: "Set up direct deposit", locked: false, completed: false },
  { id: "security", title: "IT security training", locked: true, completed: false },
];

export const EmployeeDashboardScreen = ({ route, navigation }: any) => {
  const session: UserSession = route.params.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [checklist, setChecklist] = useState<ChecklistItem[]>(INITIAL_CHECKLIST);

  const completedCount = useMemo(() => checklist.filter((i) => i.completed).length, [checklist]);
  const unlockedCount = useMemo(() => checklist.filter((i) => !i.locked).length, [checklist]);
  const percent = unlockedCount > 0 ? Math.round((completedCount / unlockedCount) * 100) : 0;

  const toggleItem = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => {
        if (item.id !== id || item.locked) return item;
        return { ...item, completed: !item.completed };
      }),
    );
  };

  return (
    <SafeAreaView style={{ backgroundColor: Colors.bgApp }} className="flex-1">
      <StatusBar barStyle="dark-content" />
      <View className="flex-1 flex-row">
        {!isMobile && (
          <Sidebar role="employee" userName={session.name} email={session.email} activeScreen="Dashboard" navigation={navigation} />
        )}

        <View className="flex-1">
          {isMobile ? (
            <MobileRoleMenu role="employee" userName={session.name} email={session.email} activeScreen="Dashboard" navigation={navigation} />
          ) : (
            <Header role="employee" userName={session.name} />
          )}

          <ScrollView className="flex-1 px-3 py-3" showsVerticalScrollIndicator={false}>
            <View style={{ backgroundColor: Colors.primary }} className="rounded-2xl px-4 py-4 mb-3">
              <Text className="text-white text-[10px] font-bold uppercase tracking-widest">Employee Dashboard</Text>
              <Text className="text-white text-lg font-bold mt-1">Welcome, {session.name}</Text>
              <Text className="text-white/80 text-xs mt-1.5 leading-5">
                Your onboarding checklist, profile basics, and completion progress.
              </Text>
            </View>

            <View className="flex-row gap-2 mb-3">
              <View className="flex-1 rounded-xl bg-white border border-gray-200 px-3 py-3">
                <Text style={{ color: Colors.textPlaceholder }} className="text-[9px] font-bold uppercase tracking-widest">Progress</Text>
                <Text style={{ color: Colors.textPrimary }} className="text-lg font-bold mt-1">{percent}%</Text>
                <Text style={{ color: Colors.textMuted }} className="text-[11px] mt-0.5">Onboarding done</Text>
              </View>
              <View className="flex-1 rounded-xl bg-white border border-gray-200 px-3 py-3">
                <Text style={{ color: Colors.textPlaceholder }} className="text-[9px] font-bold uppercase tracking-widest">Completed</Text>
                <Text style={{ color: Colors.textPrimary }} className="text-lg font-bold mt-1">{completedCount}/{unlockedCount}</Text>
                <Text style={{ color: Colors.textMuted }} className="text-[11px] mt-0.5">Tasks finished</Text>
              </View>
            </View>

            <View className="rounded-2xl bg-white p-3 border border-gray-200 mb-3">
              <Text style={{ color: Colors.textPrimary }} className="font-bold text-sm mb-2">Profile Details</Text>
              {[
                { label: "FULL NAME", value: session.name },
                { label: "ROLE", value: "Internal Staff" },
                { label: "MEMBER SINCE", value: "February 2026" },
              ].map((field) => (
                <View key={field.label} style={{ borderColor: Colors.border, backgroundColor: Colors.bgMuted }} className="rounded-lg border px-3 py-2.5 mb-2">
                  <Text style={{ color: Colors.textPlaceholder }} className="text-[9px] font-bold uppercase tracking-widest mb-1">
                    {field.label}
                  </Text>
                  <Text style={{ color: Colors.textPrimary }} className="font-semibold text-sm">{field.value}</Text>
                </View>
              ))}
            </View>

            <View className="rounded-2xl bg-white p-3 border border-gray-200 mb-6">
              <View className="flex-row items-center justify-between mb-2">
                <Text style={{ color: Colors.textPrimary }} className="font-bold text-sm">Onboarding Checklist</Text>
                <View style={{ backgroundColor: Colors.primaryLight }} className="rounded-full px-2.5 py-1">
                  <Text style={{ color: Colors.primary }} className="text-[10px] font-bold">{percent}% Complete</Text>
                </View>
              </View>

              <View style={{ backgroundColor: Colors.border }} className="h-2 rounded-full overflow-hidden mb-3">
                <View style={{ backgroundColor: Colors.primary, width: `${percent}%` }} className="h-full rounded-full" />
              </View>

              {checklist.map((item) => {
                const tagBg = item.locked ? Colors.bgSubtle : item.completed ? Colors.successLight : Colors.warningLight;
                const tagBorder = item.locked ? Colors.border : item.completed ? Colors.success : Colors.warningBorder;
                const tagText = item.locked ? Colors.textPlaceholder : item.completed ? Colors.successText : Colors.warningText;
                const statusLabel = item.locked ? "Locked" : item.completed ? "Done" : "Pending";

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggleItem(item.id)}
                    disabled={item.locked}
                    style={{ borderColor: Colors.border, backgroundColor: item.locked ? Colors.bgMuted : Colors.bgCard, opacity: item.locked ? 0.65 : 1 }}
                    className="flex-row items-center justify-between rounded-xl border px-3 py-3 mb-2"
                  >
                    <View className="flex-1 pr-3">
                      <Text style={{ color: item.locked ? Colors.textMuted : Colors.textPrimary }} className="font-semibold text-sm">
                        {item.title}
                      </Text>
                      <Text style={{ color: Colors.textPlaceholder }} className="text-[10px] uppercase font-medium mt-0.5">
                        {item.locked ? "Blocked until previous requirements are done" : "Tap to mark complete"}
                      </Text>
                    </View>

                    <View style={{ backgroundColor: tagBg, borderColor: tagBorder }} className="px-2.5 py-1 rounded-lg border">
                      <Text style={{ color: tagText }} className="text-[10px] font-bold uppercase">{statusLabel}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
};
