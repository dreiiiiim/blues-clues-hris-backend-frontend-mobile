import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";

type JobItem = {
  id: string;
  title: string;
  department: string;
  location: string;
  posted: string;
  type: string;
};

const AVAILABLE_POSITIONS: JobItem[] = [
  {
    id: "1",
    title: "Product Manager",
    department: "Product",
    location: "San Francisco, CA",
    posted: "2 days ago",
    type: "Full-time",
  },
  {
    id: "2",
    title: "UX/UI Designer",
    department: "Design",
    location: "Remote",
    posted: "5 hours ago",
    type: "Contract",
  },
  {
    id: "3",
    title: "Frontend Developer",
    department: "Engineering",
    location: "Remote",
    posted: "1 day ago",
    type: "Full-time",
  },
];

export function ApplicantDashboardScreen() {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isMobile = width < 900;
  const [search, setSearch] = useState("");

  const filteredJobs = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return AVAILABLE_POSITIONS;

    return AVAILABLE_POSITIONS.filter((job) => {
      return (
        job.title.toLowerCase().includes(keyword) ||
        job.department.toLowerCase().includes(keyword) ||
        job.location.toLowerCase().includes(keyword) ||
        job.type.toLowerCase().includes(keyword)
      );
    });
  }, [search]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar
            role="applicant"
            userName="Andrei Montañiel"
            activeScreen="Dashboard"
            navigation={navigation}
          />
        )}

        <View style={styles.mainContent}>
          {isMobile && (
            <MobileRoleMenu
              role="applicant"
              userName="Andrei Montañiel"
              activeScreen="Dashboard"
              navigation={navigation}
            />
          )}

          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroCard}>
              <View style={styles.heroTextWrap}>
                <Text style={styles.heroTitle}>Applicant Portal</Text>
                <Text style={styles.heroSubtitle}>Blue&apos;s Clues HRIS</Text>
              </View>

              {!isMobile && (
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>A</Text>
                </View>
              )}
            </View>

            <View style={styles.searchWrap}>
              <Ionicons
                name="search-outline"
                size={22}
                color="#6B7280"
                style={styles.searchIcon}
              />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search jobs..."
                placeholderTextColor="#6B7280"
                style={styles.searchInput}
              />
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionEyebrow}>Current Application</Text>
              <Text style={styles.currentStatus}>Status: In Review</Text>
              <Text style={styles.currentRole}>
                Senior Software Engineer at Tech Corp
              </Text>

              <View style={styles.phasePill}>
                <Text style={styles.phasePillText}>Active Phase</Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Application Progress</Text>

              <View style={styles.progressLabels}>
                <Text style={styles.progressLabelActive}>Applied</Text>
                <Text style={styles.progressLabelActive}>Screening</Text>
                <Text style={styles.progressLabelActive}>Interview</Text>
                <Text style={styles.progressLabelMuted}>Offer</Text>
              </View>

              <View style={styles.progressRow}>
                <View style={styles.progressStepDone}>
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                </View>

                <View style={styles.progressLineActive} />

                <View style={styles.progressStepDone}>
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                </View>

                <View style={styles.progressLineActive} />

                <View style={styles.progressStepCurrent}>
                  <Text style={styles.progressStepCurrentText}>3</Text>
                </View>

                <View style={styles.progressLineMuted} />

                <View style={styles.progressStepMuted}>
                  <Text style={styles.progressStepMutedText}>4</Text>
                </View>
              </View>
            </View>

            <View style={styles.positionsCard}>
              <Text style={styles.sectionTitle}>Available Positions</Text>
              <Text style={styles.positionsSubtitle}>
                Discover roles that match your expertise
              </Text>

              {filteredJobs.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No jobs found</Text>
                  <Text style={styles.emptySubtitle}>
                    Try using a different keyword.
                  </Text>
                </View>
              ) : (
                filteredJobs.map((job) => (
                  <View key={job.id} style={styles.jobCard}>
                    <View style={styles.jobTopRow}>
                      <View style={styles.jobTextWrap}>
                        <Text style={styles.jobTitle}>{job.title}</Text>
                        <Text style={styles.jobMeta}>
                          {job.department} • {job.location}
                        </Text>
                        <Text style={styles.jobPosted}>{job.posted}</Text>
                      </View>

                      <View style={styles.jobTypePill}>
                        <Text style={styles.jobTypeText}>{job.type}</Text>
                      </View>
                    </View>

                    <Pressable style={styles.applyButton}>
                      <Text style={styles.applyButtonText}>Apply Now →</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  layout: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
  },
  mainContent: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  heroCard: {
    backgroundColor: "#2646A3",
    borderRadius: 0,
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 4,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 16,
  },
  avatarText: {
    color: "#2646A3",
    fontSize: 20,
    fontWeight: "800",
  },
  searchWrap: {
    height: 58,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#A3A3A3",
    backgroundColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 18,
    marginBottom: 16,
  },
  sectionEyebrow: {
    color: "#3366D6",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  currentStatus: {
    color: "#0F172A",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 10,
  },
  currentRole: {
    color: "#6B7280",
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 18,
  },
  phasePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#BFD4FF",
  },
  phasePillText: {
    color: "#3366D6",
    fontSize: 14,
    fontWeight: "700",
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 18,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  progressLabelActive: {
    color: "#3366D6",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  progressLabelMuted: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressStepDone: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#3366E8",
    alignItems: "center",
    justifyContent: "center",
  },
  progressStepCurrent: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    borderWidth: 3,
    borderColor: "#3366E8",
    alignItems: "center",
    justifyContent: "center",
  },
  progressStepCurrentText: {
    color: "#3366E8",
    fontSize: 18,
    fontWeight: "800",
  },
  progressStepMuted: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F9FAFB",
    borderWidth: 3,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  progressStepMutedText: {
    color: "#9CA3AF",
    fontSize: 18,
    fontWeight: "800",
  },
  progressLineActive: {
    flex: 1,
    height: 6,
    backgroundColor: "#3366E8",
  },
  progressLineMuted: {
    flex: 1,
    height: 6,
    backgroundColor: "#D1D5DB",
  },
  positionsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 18,
  },
  positionsSubtitle: {
    color: "#6B7280",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  jobCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
  },
  jobTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  jobTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  jobTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  jobMeta: {
    color: "#6B7280",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  jobPosted: {
    color: "#6B7280",
    fontSize: 15,
    lineHeight: 22,
  },
  jobTypePill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FAFAFA",
  },
  jobTypeText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "700",
  },
  applyButton: {
    alignSelf: "flex-start",
    backgroundColor: "#3366E8",
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 20,
  },
  applyButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
  },
  emptyTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },
  emptySubtitle: {
    color: "#6B7280",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});