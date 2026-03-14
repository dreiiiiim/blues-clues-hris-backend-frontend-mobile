import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { Header } from "../components/Header";
import { MetricCard } from "../components/MetricCard";
import { Colors } from "../constants/colors";
import { UserSession, authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

type Employee = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role_id: string;
};

type JobPosting = {
  job_posting_id: string;
  status: "open" | "closed" | "draft";
};

export const HROfficerDashboardScreen = ({ route, navigation }: any) => {
  const session: UserSession = route.params.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async (cancelRef?: { cancelled: boolean }) => {
    try {
      const [usersRes, statsRes, jobsRes] = await Promise.all([
        authFetch(`${API_BASE_URL}/users`),
        authFetch(`${API_BASE_URL}/users/stats`),
        authFetch(`${API_BASE_URL}/jobs`),
      ]);

      const usersData = await usersRes.json().catch(() => []);
      const statsData = await statsRes.json().catch(() => ({}));
      const jobsData = await jobsRes.json().catch(() => []);

      if (!cancelRef?.cancelled) {
        setEmployees(Array.isArray(usersData) ? usersData : []);
        setTotalCount(statsData?.total ?? null);
        setJobs(Array.isArray(jobsData) ? jobsData : []);
      }
    } catch {
      if (!cancelRef?.cancelled) {
        setEmployees([]);
        setJobs([]);
      }
    } finally {
      if (!cancelRef?.cancelled) setLoading(false);
    }
  };

  useEffect(() => {
    const cancelRef = { cancelled: false };
    loadDashboard(cancelRef);
    return () => {
      cancelRef.cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter((e) => {
      const fullName = [e.first_name, e.last_name].filter(Boolean).join(" ").toLowerCase();
      return fullName.includes(q) || e.email.toLowerCase().includes(q);
    });
  }, [search, employees]);

  const openJobs = jobs.filter((j) => j.status === "open").length;
  const draftJobs = jobs.filter((j) => j.status === "draft").length;

  return (
    <SafeAreaView style={{ backgroundColor: Colors.bgApp }} className="flex-1">
      <StatusBar barStyle="dark-content" />
      <View className="flex-1 flex-row">
        {!isMobile && (
          <Sidebar role="hr" userName={session.name} email={session.email} activeScreen="Dashboard" navigation={navigation} />
        )}

        <View className="flex-1">
          {isMobile ? (
            <MobileRoleMenu role="hr" userName={session.name} email={session.email} activeScreen="Dashboard" navigation={navigation} />
          ) : (
            <Header role="hr" userName={session.name} />
          )}

          <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
            <View style={{ backgroundColor: Colors.primary }} className="rounded-2xl p-5 mb-4">
              <Text className="text-white text-[10px] font-bold uppercase tracking-widest">HR Control Center</Text>
              <Text className="text-white text-xl font-bold mt-1">Welcome, {session.name}</Text>
              <Text className="text-white/80 text-xs mt-2 leading-5">
                Daily staffing visibility and recruitment shortcuts in one place.
              </Text>

              <View className="flex-row gap-2 mt-4">
                <Pressable
                  onPress={() => navigation.navigate("HROfficerRecruitment", { session })}
                  style={{ backgroundColor: "rgba(255,255,255,0.15)", borderColor: "rgba(255,255,255,0.25)" }}
                  className="px-3 py-2 rounded-lg border"
                >
                  <Text className="text-white text-[11px] font-bold uppercase tracking-wider">Recruitment</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setLoading(true);
                    loadDashboard();
                  }}
                  style={{ backgroundColor: "rgba(255,255,255,0.15)", borderColor: "rgba(255,255,255,0.25)" }}
                  className="px-3 py-2 rounded-lg border"
                >
                  <Text className="text-white text-[11px] font-bold uppercase tracking-wider">Refresh</Text>
                </Pressable>
              </View>
            </View>

            <View className="flex-row gap-3 mb-4">
              <MetricCard
                label="Headcount"
                value={totalCount !== null ? String(totalCount) : "--"}
                sub="Active employees"
                trend=""
              />
              <MetricCard
                label="Open Jobs"
                value={String(openJobs)}
                sub="Accepting applicants"
                trend=""
              />
            </View>

            <View className="mb-4">
              <MetricCard
                label="Draft Jobs"
                value={String(draftJobs)}
                sub="Need publishing"
                trend=""
                alert={draftJobs > 0}
              />
            </View>

            <View className="rounded-2xl bg-white shadow-sm mb-6 overflow-hidden">
              <View style={{ backgroundColor: Colors.bgMuted, borderBottomColor: Colors.border }} className="px-4 pt-4 pb-3 border-b">
                <Text style={{ color: Colors.textPrimary }} className="font-bold text-base">Employee Directory</Text>
                <Text style={{ color: Colors.textMuted }} className="text-xs mt-0.5">All employees in your company</Text>
                <View style={{ borderColor: Colors.border }} className="mt-3 flex-row items-center rounded-xl border bg-white px-3 py-2.5">
                  <Text style={{ color: Colors.textPlaceholder }} className="mr-2">Search</Text>
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search employees..."
                    placeholderTextColor={Colors.textPlaceholder}
                    style={{ color: Colors.textPrimary }}
                    className="flex-1 text-xs"
                  />
                </View>
              </View>

              <View style={{ backgroundColor: Colors.bgSubtle, borderBottomColor: Colors.border }} className="flex-row px-4 py-2 border-b">
                <Text style={{ color: Colors.textPlaceholder }} className="flex-1 text-[9px] font-bold uppercase tracking-widest">Employee</Text>
                <Text style={{ color: Colors.textPlaceholder }} className="w-16 text-[9px] font-bold uppercase tracking-widest">Status</Text>
              </View>

              {loading ? (
                <View className="px-4 py-8 items-center">
                  <ActivityIndicator color={Colors.primary} />
                </View>
              ) : (
                <>
                  {filtered.map((row) => {
                    const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email;
                    const initials = (row.first_name?.charAt(0) ?? row.email.charAt(0)).toUpperCase();
                    return (
                      <View key={row.user_id} style={{ borderBottomColor: Colors.bgSubtle }} className="flex-row items-center px-4 py-3 border-b">
                        <View className="flex-1 flex-row items-center">
                          <View style={{ backgroundColor: Colors.primaryLight, borderColor: Colors.primaryBorder }} className="h-9 w-9 rounded-full items-center justify-center mr-3 border">
                            <Text style={{ color: Colors.primary }} className="font-bold text-sm">{initials}</Text>
                          </View>
                          <View className="flex-1">
                            <Text style={{ color: Colors.textPrimary }} className="font-semibold text-sm">{fullName}</Text>
                            <Text style={{ color: Colors.textPlaceholder }} className="text-[10px]">{row.email}</Text>
                          </View>
                        </View>
                        <View className="w-16 items-end">
                          <View style={{ backgroundColor: Colors.success + "22" }} className="px-2 py-0.5 rounded-full">
                            <Text style={{ color: Colors.successText }} className="text-[9px] font-bold uppercase">Active</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}

                  {filtered.length === 0 && (
                    <View className="px-4 py-8 items-center">
                      <Text style={{ color: Colors.textPlaceholder }} className="text-sm">No employees found.</Text>
                    </View>
                  )}
                </>
              )}

              <View style={{ backgroundColor: Colors.bgMuted }} className="px-4 py-3">
                <Text style={{ color: Colors.textPlaceholder }} className="text-[10px] font-bold uppercase tracking-widest">
                  Showing {filtered.length} of {employees.length} employees
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
};
