import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { LoginScreen } from "../screens/LoginScreen";
import { SignUpScreen } from "../screens/SignUpScreen";
import { ForgotPasswordScreen } from "../screens/ForgotPasswordScreen";
import { EmployeeDashboardScreen } from "../screens/EmployeeDashboardScreen";
import { EmployeeOnboardingScreen } from "../screens/EmployeeOnboardingScreen";
import {
  ApplicantOnboardingScreen,
  ApplicantProfileScreen,
  EmployeeDocumentsScreen,
  EmployeeLeaveScreen,
  EmployeeOffboardingScreen,
  EmployeePayslipsScreen,
  EmployeePerformanceScreen,
  EmployeeProfileScreen,
  HROffboardingScreen,
  HROfficerApprovalsScreen,
  HROfficerPerformanceScreen,
  HROfficerPayslipsScreen,
  ManagerApprovalsScreen,
  ManagerOffboardingScreen,
  ManagerPayslipsScreen,
  ManagerPerformanceScreen,
  SystemAdminApprovalsScreen,
  SystemAdminCompensationSettingsScreen,
  SystemAdminOffboardingScreen,
  SystemAdminPerformanceSettingsScreen,
  SystemAdminSettingsScreen,
  SystemAdminSubscriptionsScreen,
  SystemAdminTimekeepingScreen,
} from "../screens/ExpandedScreens";
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
import { SystemAdminUsersScreen } from "../screens/SystemAdminUsersScreen";
import { SystemAdminAuditLogsScreen } from "../screens/SystemAdminAuditLogsScreen";
import { EmployeeTimekeepingScreen } from "../screens/EmployeeTimekeepingScreen";

type SessionParam = { session: { name: string; role: string; email: string } };

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;

  // Employee
  EmployeeDashboard: SessionParam;
  EmployeeOnboarding: SessionParam;
  EmployeeTimekeeping: SessionParam;
  EmployeeProfile: SessionParam;
  EmployeeLeave: SessionParam;
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

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        id="root-stack"
        initialRouteName="Login"
        screenOptions={{ headerShown: false }}
      >
        {/* Auth */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />

        {/* Employee */}
        <Stack.Screen name="EmployeeDashboard" component={EmployeeDashboardScreen} />
        <Stack.Screen name="EmployeeOnboarding" component={EmployeeOnboardingScreen} />
        <Stack.Screen name="EmployeeTimekeeping" component={EmployeeTimekeepingScreen} />
        <Stack.Screen name="EmployeeProfile" component={EmployeeProfileScreen} />
        <Stack.Screen name="EmployeeLeave" component={EmployeeLeaveScreen} />
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
        <Stack.Screen name="SystemAdminBilling" component={SystemAdminSubscriptionsScreen} />
        <Stack.Screen name="SystemAdminTimekeeping" component={SystemAdminTimekeepingScreen} />
        <Stack.Screen name="SystemAdminOffboarding" component={SystemAdminOffboardingScreen} />
        <Stack.Screen name="SystemAdminApprovals" component={SystemAdminApprovalsScreen} />
        <Stack.Screen name="SystemAdminCompensationSettings" component={SystemAdminCompensationSettingsScreen} />
        <Stack.Screen name="SystemAdminSubscriptions" component={SystemAdminSubscriptionsScreen} />
        <Stack.Screen name="SystemAdminPerformanceSettings" component={SystemAdminPerformanceSettingsScreen} />
        <Stack.Screen name="SystemAdminSettings" component={SystemAdminSettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
