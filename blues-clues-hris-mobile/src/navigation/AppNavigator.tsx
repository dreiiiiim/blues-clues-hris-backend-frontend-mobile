import React, { useRef } from "react";
import { Dimensions, PanResponder, View } from "react-native";
import { NavigationContainer, createNavigationContainerRef, CommonActions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { LoginScreen } from "../screens/LoginScreen";
import { SignUpScreen } from "../screens/SignUpScreen";
import { ForgotPasswordScreen } from "../screens/ForgotPasswordScreen";
import { ApplicantVerifyEmailScreen } from "../screens/ApplicantVerifyEmailScreen";
import { EmployeeDashboardScreen } from "../screens/EmployeeDashboardScreen";
import { EmployeeOnboardingScreen } from "../screens/EmployeeOnboardingScreen";
import { EmployeeOffboardingScreen } from "../screens/EmployeeOffboardingScreen";
import { ApplicantProfileScreen } from "../screens/ApplicantProfileScreen";
import { ApplicantOnboardingScreen } from "../screens/ApplicantOnboardingScreen";
import { EmployeeProfileScreen } from "../screens/EmployeeProfileScreen";
import { EmployeePayslipsScreen } from "../screens/EmployeePayslipsScreen";
import { EmployeeDocumentsScreen } from "../screens/EmployeeDocumentsScreen";
import { EmployeePerformanceScreen } from "../screens/EmployeePerformanceScreen";
import { ManagerPerformanceScreen } from "../screens/ManagerPerformanceScreen";
import { ManagerOffboardingScreen } from "../screens/ManagerOffboardingScreen";
import { ManagerPayslipsScreen } from "../screens/ManagerPayslipsScreen";
import { HROffboardingScreen } from "../screens/HROffboardingScreen";
import { HROfficerPerformanceScreen } from "../screens/HROfficerPerformanceScreen";
import { HROfficerPayslipsScreen } from "../screens/HROfficerPayslipsScreen";
import { HROfficerPayrollScreen } from "../screens/HROfficerPayrollScreen";
import { SystemAdminTimekeepingScreen } from "../screens/SystemAdminTimekeepingScreen";
import { SystemAdminOffboardingScreen } from "../screens/SystemAdminOffboardingScreen";
import { SystemAdminApprovalsScreen } from "../screens/SystemAdminApprovalsScreen";
import { SystemAdminCompensationSettingsScreen } from "../screens/SystemAdminCompensationSettingsScreen";
import { SystemAdminSubscriptionsScreen } from "../screens/SystemAdminSubscriptionsScreen";
import { SystemAdminPerformanceSettingsScreen } from "../screens/SystemAdminPerformanceSettingsScreen";
import { SystemAdminSettingsScreen } from "../screens/SystemAdminSettingsScreen";
import { EmployeeLeaveScreen } from "../screens/EmployeeLeaveScreen";
import { EmployeeOvertimeScreen } from "../screens/EmployeeOvertimeScreen";
import { HROfficerApprovalsScreen } from "../screens/HROfficerApprovalsScreen";
import { ManagerApprovalsScreen } from "../screens/ManagerApprovalsScreen";
import { HROfficerDashboardScreen } from "../screens/HROfficerDashboardScreen";
import { HROfficerOnboardingScreen } from "../screens/HROfficerOnboardingScreen";
import { HROfficerRecruitmentScreen } from "../screens/HROfficerRecruitmentScreen";
import { HROfficerCandidateEvaluationScreen } from "../screens/HROfficerCandidateEvaluationScreen";
import { HROfficerTimekeepingScreen } from "../screens/HROfficerTimekeepingScreen";
import { ManagerDashboardScreen } from "../screens/ManagerDashboardScreen";
import { ManagerTeamScreen } from "../screens/ManagerTeamScreen";
import { ManagerTimekeepingScreen } from "../screens/ManagerTimekeepingScreen";
import { ApplicantDashboardScreen } from "../screens/ApplicantDashboardScreen";
import { ApplicantJobsScreen } from "../screens/ApplicantJobsScreen";
import { ApplicantApplicationsScreen } from "../screens/ApplicantApplicationsScreen";
import { ApplicantResumeUploadScreen } from "../screens/ApplicantResumeUploadScreen";
import { SystemAdminDashboardScreen } from "../screens/SystemAdminDashboardScreen";
import { SystemAdminOnboardingScreen } from "../screens/SystemAdminOnboardingScreen";
import { SystemAdminBillingScreen } from "../screens/SystemAdminBillingScreen";
import { SystemAdminUsersScreen } from "../screens/SystemAdminUsersScreen";
import { SystemAdminAuditLogsScreen } from "../screens/SystemAdminAuditLogsScreen";
import { EmployeeTimekeepingScreen } from "../screens/EmployeeTimekeepingScreen";
import { PortalSelectScreen } from "../screens/PortalSelectScreen";

type SessionParam = { session: { name: string; role: string; email: string } };

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  ApplicantVerifyEmail: any;
  PortalSelect: any;

  // Employee
  EmployeeDashboard: SessionParam;
  EmployeeOnboarding: SessionParam;
  EmployeeTimekeeping: SessionParam;
  EmployeeProfile: SessionParam;
  EmployeeLeave: SessionParam;
  EmployeeOvertime: SessionParam;
  EmployeePayslips: SessionParam;
  EmployeeDocuments: SessionParam;
  EmployeePerformance: SessionParam;
  EmployeeOffboarding: SessionParam;

  // Manager
  ManagerDashboard: SessionParam;
  ManagerTeam: SessionParam;
  ManagerTimekeeping: SessionParam;
  ManagerPerformance: SessionParam;
  ManagerOffboarding: SessionParam;
  ManagerApprovals: SessionParam;
  ManagerPayslips: SessionParam;

  // HR Officer
  HROfficerDashboard: SessionParam;
  HROfficerOnboarding: SessionParam;
  HROfficerRecruitment: SessionParam;
  HROfficerJobs: SessionParam;
  HROfficerCandidates: SessionParam;
  HROfficerTimekeeping: SessionParam;
  HROfficerOffboarding: SessionParam;
  HROfficerApprovals: SessionParam;
  HROfficerPerformance: SessionParam;
  HROfficerPayroll: SessionParam;
  HROfficerPayslips: SessionParam;

  // Applicant
  ApplicantDashboard: SessionParam;
  ApplicantJobs: SessionParam;
  ApplicantApplications: SessionParam;
  ApplicantResumeUpload: SessionParam;
  ApplicantProfile: SessionParam;
  ApplicantOnboarding: SessionParam;

  // System Admin / Admin
  SystemAdminDashboard: SessionParam;
  SystemAdminOnboarding: SessionParam;
  SystemAdminUsers: SessionParam;
  SystemAdminBilling: SessionParam;
  SystemAdminAuditLogs: SessionParam;
  SystemAdminTimekeeping: SessionParam;
  SystemAdminOffboarding: SessionParam;
  SystemAdminApprovals: SessionParam;
  SystemAdminCompensationSettings: SessionParam;
  SystemAdminSubscriptions: SessionParam;
  SystemAdminPerformanceSettings: SessionParam;
  SystemAdminSettings: SessionParam;
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const MAIN_TABS: Record<string, string[]> = {
  employee: ["EmployeeDashboard", "EmployeeLeave", "EmployeeTimekeeping", "EmployeePayslips"],
  hr: ["HROfficerDashboard", "HROfficerJobs", "HROfficerApprovals", "HROfficerOnboarding"],
  manager: ["ManagerDashboard", "ManagerTeam", "ManagerTimekeeping", "ManagerApprovals"],
  applicant: ["ApplicantDashboard", "ApplicantJobs", "ApplicantApplications", "ApplicantProfile", "ApplicantOnboarding"],
  system_admin: ["SystemAdminDashboard", "SystemAdminUsers", "SystemAdminAuditLogs", "SystemAdminApprovals"],
  admin: ["SystemAdminDashboard", "SystemAdminUsers", "SystemAdminAuditLogs"],
};

export function AppNavigator() {
  function navigateTab(direction: "next" | "prev") {
    if (!navigationRef.isReady()) return;
    const route = navigationRef.getCurrentRoute();
    if (!route) return;

    const activeScreen = route.name;
    const session = (route.params as any)?.session;
    if (!session || !session.role) return;

    const role = session.role;
    const tabs = MAIN_TABS[role] || [];
    if (tabs.length === 0) return;

    const currentIdx = tabs.indexOf(activeScreen);
    if (currentIdx === -1) return;

    let targetIdx = direction === "next" ? currentIdx + 1 : currentIdx - 1;

    if (targetIdx < 0) {
      targetIdx = tabs.length - 1;
    } else if (targetIdx >= tabs.length) {
      targetIdx = 0;
    }

    const targetScreen = tabs[targetIdx];
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: targetScreen as any, params: { session } }],
      })
    );
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        const pageY = evt.nativeEvent.pageY;
        const SCREEN_HEIGHT = Dimensions.get("window").height;
        // Completely exempt bottom navigation bar zone (90px) to ensure perfect tapping responsiveness
        if (pageY > SCREEN_HEIGHT - 90) {
          return false;
        }

        // Natural relative horizontal-to-vertical movement ratio
        const isHorizontal = Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2;
        if (isHorizontal && navigationRef.isReady()) {
          const route = navigationRef.getCurrentRoute();
          if (route) {
            const session = (route.params as any)?.session;
            const tabs = MAIN_TABS[session?.role] || [];
            if (tabs.includes(route.name)) {
              if (gestureState.dx > 0) {
                navigateTab("prev");
              } else {
                navigateTab("next");
              }
              return true;
            }
          }
        }
        return false;
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  return (
    <View {...panResponder.panHandlers} style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          id="root-stack"
          initialRouteName="Login"
          screenOptions={{ headerShown: false }}
        >
        {/* Auth */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ApplicantVerifyEmail" component={ApplicantVerifyEmailScreen} />
        <Stack.Screen name="PortalSelect" component={PortalSelectScreen} />

        {/* Employee */}
        <Stack.Screen name="EmployeeDashboard" component={EmployeeDashboardScreen} />
        <Stack.Screen name="EmployeeOnboarding" component={EmployeeOnboardingScreen} />
        <Stack.Screen name="EmployeeTimekeeping" component={EmployeeTimekeepingScreen} />
        <Stack.Screen name="EmployeeProfile" component={EmployeeProfileScreen} />
        <Stack.Screen name="EmployeeLeave" component={EmployeeLeaveScreen} />
        <Stack.Screen name="EmployeeOvertime" component={EmployeeOvertimeScreen} />
        <Stack.Screen name="EmployeePayslips" component={EmployeePayslipsScreen} />
        <Stack.Screen name="EmployeeDocuments" component={EmployeeDocumentsScreen} />
        <Stack.Screen name="EmployeePerformance" component={EmployeePerformanceScreen} />
        <Stack.Screen name="EmployeeOffboarding" component={EmployeeOffboardingScreen} />

        {/* Manager */}
        <Stack.Screen name="ManagerDashboard" component={ManagerDashboardScreen} />
        <Stack.Screen name="ManagerTeam" component={ManagerTeamScreen} />
        <Stack.Screen name="ManagerTimekeeping" component={ManagerTimekeepingScreen} />
        <Stack.Screen name="ManagerPerformance" component={ManagerPerformanceScreen} />
        <Stack.Screen name="ManagerOffboarding" component={ManagerOffboardingScreen} />
        <Stack.Screen name="ManagerApprovals" component={ManagerApprovalsScreen} />
        <Stack.Screen name="ManagerPayslips" component={ManagerPayslipsScreen} />

        {/* HR Officer */}
        <Stack.Screen name="HROfficerDashboard" component={HROfficerDashboardScreen} />
        <Stack.Screen name="HROfficerOnboarding" component={HROfficerOnboardingScreen} />
        <Stack.Screen name="HROfficerRecruitment" component={HROfficerRecruitmentScreen} />
        <Stack.Screen name="HROfficerJobs" component={HROfficerRecruitmentScreen} />
        <Stack.Screen name="HROfficerCandidates" component={HROfficerCandidateEvaluationScreen} />
        <Stack.Screen name="HROfficerTimekeeping" component={HROfficerTimekeepingScreen} />
        <Stack.Screen name="HROfficerOffboarding" component={HROffboardingScreen} />
        <Stack.Screen name="HROfficerApprovals" component={HROfficerApprovalsScreen} />
        <Stack.Screen name="HROfficerPerformance" component={HROfficerPerformanceScreen} />
        <Stack.Screen name="HROfficerPayroll" component={HROfficerPayrollScreen} />
        <Stack.Screen name="HROfficerPayslips" component={HROfficerPayslipsScreen} />

        {/* Applicant */}
        <Stack.Screen name="ApplicantDashboard" component={ApplicantDashboardScreen} />
        <Stack.Screen name="ApplicantJobs" component={ApplicantJobsScreen} />
        <Stack.Screen name="ApplicantApplications" component={ApplicantApplicationsScreen} />
        <Stack.Screen name="ApplicantResumeUpload" component={ApplicantResumeUploadScreen} />
        <Stack.Screen name="ApplicantProfile" component={ApplicantProfileScreen} />
        <Stack.Screen name="ApplicantOnboarding" component={ApplicantOnboardingScreen} />

        {/* System Admin */}
        <Stack.Screen name="SystemAdminDashboard" component={SystemAdminDashboardScreen} />
        <Stack.Screen name="SystemAdminOnboarding" component={SystemAdminOnboardingScreen} />
        <Stack.Screen name="SystemAdminUsers" component={SystemAdminUsersScreen} />
        <Stack.Screen name="SystemAdminAuditLogs" component={SystemAdminAuditLogsScreen} />
        <Stack.Screen name="SystemAdminBilling" component={SystemAdminBillingScreen} />
        <Stack.Screen name="SystemAdminTimekeeping" component={SystemAdminTimekeepingScreen} />
        <Stack.Screen name="SystemAdminOffboarding" component={SystemAdminOffboardingScreen} />
        <Stack.Screen name="SystemAdminApprovals" component={SystemAdminApprovalsScreen} />
        <Stack.Screen name="SystemAdminCompensationSettings" component={SystemAdminCompensationSettingsScreen} />
        <Stack.Screen name="SystemAdminSubscriptions" component={SystemAdminSubscriptionsScreen} />
        <Stack.Screen name="SystemAdminPerformanceSettings" component={SystemAdminPerformanceSettingsScreen} />
        <Stack.Screen name="SystemAdminSettings" component={SystemAdminSettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
    </View>
  );
}
