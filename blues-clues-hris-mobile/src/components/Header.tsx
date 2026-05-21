import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { UserRole } from "../services/auth";
import { SEARCH_PLACEHOLDERS } from "../constants/config";
import { Colors } from "../constants/colors";
import { getInitial } from "../lib/utils";
import { API_BASE_URL } from "../lib/api";

type Props = {
  role?: UserRole;
  userName?: string;
  applicantId?: string;
  title?: string;
  subtitle?: string;
};

type Notification = {
  notification_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export const Header = ({ role, userName, applicantId, title, subtitle }: Props) => {
  const safeRole = role ?? "employee";
  const safeUserName = userName ?? "Blue's Clues User";
  const initial = getInitial(safeUserName);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  useEffect(() => {
    if (notificationOpen && applicantId && safeRole === "applicant") {
      fetchNotifications();
    }
  }, [notificationOpen, applicantId, safeRole]);

  const fetchNotifications = async () => {
    try {
      setLoadingNotifications(true);
      const res = await fetch(
        `${API_BASE_URL}/notifications/applicant/${applicantId}`,
      );
      const data = await res.json().catch(() => []);
      if (Array.isArray(data)) {
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.is_read).length);
      }
    } catch {
      setNotifications([]);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <View
      style={{
        borderBottomColor: Colors.border,
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        gap: 12,
        borderBottomWidth: 1,
        position: "relative",
      }}
    >
      {(title || subtitle) && (
        <View style={{ marginBottom: 4 }}>
          {title ? (
            <Text style={{ color: Colors.textPrimary, fontSize: 20, fontWeight: "800", lineHeight: 24 }}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      )}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      {/* Search Bar */}
      <View style={{ flex: 1, marginRight: 12 }}>
        <View
          style={{
            borderColor: Colors.border,
            backgroundColor: Colors.bgMuted,
            borderRadius: 12,
            borderWidth: 1,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text
            style={{ color: Colors.textPlaceholder, fontSize: 12 }}
          >
            {SEARCH_PLACEHOLDERS[safeRole]}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, position: "relative", zIndex: 10 }}>
        {/* Notification Bell */}
        <Pressable
          onPress={() => setNotificationOpen(!notificationOpen)}
          style={{ position: "relative" }}
        >
          <View
            style={{
              backgroundColor: Colors.primaryLight,
              height: 36,
              width: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text>🔔</Text>
          </View>
          {unreadCount > 0 && (
            <View
              style={{
                backgroundColor: Colors.danger,
                borderColor: Colors.bgCard,
                position: "absolute",
                top: -2,
                right: -2,
                height: 10,
                width: 10,
                borderRadius: 5,
                borderWidth: 2,
              }}
            />
          )}

          {/* Dropdown Menu */}
          {notificationOpen && (
            <View
              style={{
                position: "absolute",
                top: 45,
                right: 0,
                width: 280,
                backgroundColor: "#FFFFFF",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: Colors.border,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
                elevation: 5,
                zIndex: 1000,
              }}
            >
              {/* Header */}
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: "#F1F5F9",
                }}
              >
                <Text
                  style={{
                    color: Colors.textPrimary,
                    fontWeight: "700",
                    fontSize: 14,
                  }}
                >
                  Notifications
                </Text>
              </View>

              {/* Content */}
              {loadingNotifications ? (
                <View
                  style={{
                    paddingVertical: 32,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              ) : notifications.length === 0 ? (
                <View
                  style={{
                    paddingVertical: 24,
                    paddingHorizontal: 16,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: Colors.textSecondary,
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  >
                    No notifications yet
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={{ maxHeight: 300 }}
                  showsVerticalScrollIndicator={false}
                >
                  {notifications.map((notif) => (
                    <View
                      key={notif.notification_id}
                      style={{
                        backgroundColor: notif.is_read ? "#FFFFFF" : "#F0F9FF",
                        borderBottomColor: Colors.border,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                      }}
                    >
                      <Text
                        style={{
                          color: Colors.textPrimary,
                          fontSize: 12,
                          lineHeight: 16,
                        }}
                      >
                        {notif.message}
                      </Text>
                      <Text
                        style={{
                          color: Colors.textSecondary,
                          fontSize: 12,
                          marginTop: 4,
                        }}
                      >
                        {formatDate(notif.created_at)}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </Pressable>

        {/* Avatar */}
        <View
          style={{
            backgroundColor: Colors.primary,
            height: 36,
            width: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontWeight: "700",
              fontSize: 14,
            }}
          >
            {initial}
          </Text>
        </View>
      </View>
      </View>
    </View>
  );
};
