import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { UserSession, getSession } from "../services/auth";
import { Colors } from "../constants/colors";

import { LoginScreen }             from "../screens/LoginScreen";
import { SignUpScreen }             from "../screens/SignUpScreen";
import { ForgotPasswordScreen }     from "../screens/ForgotPasswordScreen";
import { EmployeeDashboardScreen }  from "../screens/EmployeeDashboardScreen";
import { HROfficerDashboardScreen } from "../screens/HROfficerDashboardScreen";
import { ManagerDashboardScreen }   from "../screens/ManagerDashboardScreen";
import { ApplicantDashboardScreen }    from "../screens/ApplicantDashboardScreen";
import { SystemAdminDashboardScreen }  from "../screens/SystemAdminDashboardScreen";

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  EmployeeDashboard:     { session: UserSession };
  HROfficerDashboard:    { session: UserSession };
  ManagerDashboard:      { session: UserSession };
  ApplicantDashboard:    { session: UserSession };
  SystemAdminDashboard:  { session: UserSession };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Maps role → screen name
const ROLE_SCREEN: Record<string, keyof RootStackParamList> = {
  employee:     "EmployeeDashboard",
  hr:           "HROfficerDashboard",
  manager:      "ManagerDashboard",
  applicant:    "ApplicantDashboard",
  system_admin: "SystemAdminDashboard",
  admin:        "SystemAdminDashboard",
};

export const AppNavigator = () => {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
  const [initialSession, setInitialSession] = useState<UserSession | null>(null);
  const [checking, setChecking] = useState(true);

  // Fix 4: Restore session on cold start
  useEffect(() => {
    getSession().then((session) => {
      if (session && ROLE_SCREEN[session.role]) {
        setInitialRoute(ROLE_SCREEN[session.role]);
        setInitialSession(session);
      } else {
        setInitialRoute("Login");
      }
      setChecking(false);
    });
  }, []);

  // Show splash/loader while checking session
  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bgApp, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        id="RootStack"
        initialRouteName={initialRoute ?? "Login"}
        screenOptions={{ headerShown: false }}
      >
        {/* Auth */}
        <Stack.Screen name="Login"          component={LoginScreen} />
        <Stack.Screen name="SignUp"          component={SignUpScreen} />
        <Stack.Screen name="ForgotPassword"  component={ForgotPasswordScreen} />

        {/* Role Dashboards — session passed as param, also restored from storage */}
        <Stack.Screen
          name="EmployeeDashboard"
          component={EmployeeDashboardScreen}
          initialParams={initialRoute === "EmployeeDashboard" ? { session: initialSession } : undefined}
        />
        <Stack.Screen
          name="HROfficerDashboard"
          component={HROfficerDashboardScreen}
          initialParams={initialRoute === "HROfficerDashboard" ? { session: initialSession } : undefined}
        />
        <Stack.Screen
          name="ManagerDashboard"
          component={ManagerDashboardScreen}
          initialParams={initialRoute === "ManagerDashboard" ? { session: initialSession } : undefined}
        />
        <Stack.Screen
          name="ApplicantDashboard"
          component={ApplicantDashboardScreen}
          initialParams={initialRoute === "ApplicantDashboard" ? { session: initialSession } : undefined}
        />
        <Stack.Screen
          name="SystemAdminDashboard"
          component={SystemAdminDashboardScreen}
          initialParams={initialRoute === "SystemAdminDashboard" ? { session: initialSession } : undefined}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
