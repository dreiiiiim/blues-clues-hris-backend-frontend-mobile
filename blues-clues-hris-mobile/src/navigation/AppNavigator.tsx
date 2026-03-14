import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { LoginScreen } from "../screens/LoginScreen";
import { SignUpScreen } from "../screens/SignUpScreen";
import { ForgotPasswordScreen } from "../screens/ForgotPasswordScreen";
import { EmployeeDashboardScreen } from "../screens/EmployeeDashboardScreen";
import { HROfficerDashboardScreen } from "../screens/HROfficerDashboardScreen";
import { ManagerDashboardScreen } from "../screens/ManagerDashboardScreen";
import { ApplicantDashboardScreen } from "../screens/ApplicantDashboardScreen";
import { SystemAdminDashboardScreen } from "../screens/SystemAdminDashboardScreen";
import { SystemAdminUsersScreen } from "../screens/SystemAdminUsersScreen";
import { SystemAdminBillingScreen } from "../screens/SystemAdminBillingScreen";

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  EmployeeDashboard: undefined;
  HROfficerDashboard: undefined;
  ManagerDashboard: undefined;
  ApplicantDashboard: undefined;
  SystemAdminDashboard: undefined;
  SystemAdminUsers: undefined;
  SystemAdminBilling: undefined;
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}