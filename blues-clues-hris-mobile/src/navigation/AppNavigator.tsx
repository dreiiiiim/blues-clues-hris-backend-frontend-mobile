import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { LoginScreen } from "../screens/LoginScreen";
import { SignUpScreen } from "../screens/SignUpScreen";
import { ForgotPasswordScreen } from "../screens/ForgotPasswordScreen";
import { EmployeeDashboardScreen } from "../screens/EmployeeDashboardScreen";
import { HROfficerDashboardScreen } from "../screens/HROfficerDashboardScreen";
import { HROfficerRecruitmentScreen } from "../screens/HROfficerRecruitmentScreen";
import { ManagerDashboardScreen } from "../screens/ManagerDashboardScreen";
import { ApplicantDashboardScreen } from "../screens/ApplicantDashboardScreen";
import { SystemAdminDashboardScreen } from "../screens/SystemAdminDashboardScreen";
import { SystemAdminUsersScreen } from "../screens/SystemAdminUsersScreen";
import { SystemAdminBillingScreen } from "../screens/SystemAdminBillingScreen";
import { EmployeeTimekeepingScreen } from "../screens/EmployeeTimekeepingScreen";
import { HROfficerTimekeepingScreen } from "../screens/HROfficerTimekeepingScreen";
import { ApplicantJobsScreen } from "../screens/ApplicantJobsScreen";

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  EmployeeDashboard: { session: { name: string; role: string; email: string } };
  HROfficerDashboard: { session: { name: string; role: string; email: string } };
  HROfficerRecruitment: { session: { name: string; role: string; email: string } };
  ManagerDashboard: { session: { name: string; role: string; email: string } };
  ApplicantDashboard: { session: { name: string; role: string; email: string } };
  SystemAdminDashboard: { session: { name: string; role: string; email: string } };
  SystemAdminUsers: { session: { name: string; role: string; email: string } };
  SystemAdminBilling: { session: { name: string; role: string; email: string } };
  EmployeeTimekeeping: { session: { name: string; role: string; email: string } };
  HROfficerTimekeeping: { session: { name: string; role: string; email: string } };
  ApplicantJobs: { session: { name: string; role: string; email: string } };
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
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen
          name="EmployeeDashboard"
          component={EmployeeDashboardScreen}
        />
        <Stack.Screen
          name="HROfficerDashboard"
          component={HROfficerDashboardScreen}
        />
        <Stack.Screen
          name="HROfficerRecruitment"
          component={HROfficerRecruitmentScreen}
        />
        <Stack.Screen
          name="ManagerDashboard"
          component={ManagerDashboardScreen}
        />
        <Stack.Screen
          name="ApplicantDashboard"
          component={ApplicantDashboardScreen}
        />
        <Stack.Screen
          name="SystemAdminDashboard"
          component={SystemAdminDashboardScreen}
        />
        <Stack.Screen
          name="SystemAdminUsers"
          component={SystemAdminUsersScreen}
        />
        <Stack.Screen
          name="SystemAdminBilling"
          component={SystemAdminBillingScreen}
        />
        <Stack.Screen
          name="EmployeeTimekeeping"
          component={EmployeeTimekeepingScreen}
        />
        <Stack.Screen
          name="HROfficerTimekeeping"
          component={HROfficerTimekeepingScreen}
        />
        <Stack.Screen
          name="ApplicantJobs"
          component={ApplicantJobsScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
