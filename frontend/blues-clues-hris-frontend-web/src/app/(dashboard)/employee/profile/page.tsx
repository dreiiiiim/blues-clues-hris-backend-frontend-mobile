"use client";

import { useEffect, useState } from "react";
import { getUserInfo, saveUserInfo, type StoredUser } from "@/lib/authStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User, Mail, Shield, PencilLine, Save } from "lucide-react";

export default function EmployeeProfilePage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [username, setUsername] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const storedUser = getUserInfo();
    setUser(storedUser);
    setUsername(storedUser?.name || "");
  }, []);

  const handleCancel = () => {
    setUsername(user?.name || "");
    setIsEditing(false);
    setStatusMessage("");
  };

  const handleSave = () => {
    if (!user) return;

    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      setStatusMessage("Username cannot be empty.");
      return;
    }

    const updatedUser: StoredUser = {
      ...user,
      name: trimmedUsername,
    };

    saveUserInfo(updatedUser);
    setUser(updatedUser);
    setUsername(trimmedUsername);
    setIsEditing(false);
    setStatusMessage("Profile updated successfully.");

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("user-info-updated"));
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="rounded-2xl shadow-sm border-gray-100">
          <CardContent className="py-10">
            <p className="text-sm text-gray-500 text-center">Loading profile...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-[#1e3a8a] text-white p-8 shadow-sm">
        <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-white/10 -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 right-16 h-24 w-24 rounded-full bg-white/10 translate-y-1/2" />
        <div className="relative z-10">
          <p className="text-sm uppercase tracking-[0.2em] text-white/70 font-semibold mb-2">
            Employee Profile
          </p>
          <h1 className="text-3xl font-bold mb-2">Manage your account details</h1>
          <p className="text-sm text-white/80 max-w-2xl">
            View your personal account information and update your username for your employee portal profile.
          </p>
        </div>
      </div>

      <Card className="rounded-2xl shadow-sm border-gray-100">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold text-gray-900">Profile Information</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-bold border border-blue-200">
              {user.name?.charAt(0)?.toUpperCase() || "U"}
            </div>

            <div>
              <p className="text-lg font-semibold text-gray-900">{user.name}</p>
              <p className="text-sm text-gray-500">Employee account</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                Username
              </label>

              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={!isEditing}
                placeholder="Enter your username"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-500" />
                Email
              </label>

              <Input
                value={user.email}
                disabled
                className="h-11 bg-gray-50 text-gray-500"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Shield className="h-4 w-4 text-gray-500" />
                Role
              </label>

              <Input
                value={user.role}
                disabled
                className="h-11 bg-gray-50 text-gray-500"
              />
            </div>
          </div>

          {statusMessage && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-sm text-blue-700">{statusMessage}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} className="h-11 px-5">
                <PencilLine className="h-4 w-4 mr-2" />
                Edit Username
              </Button>
            ) : (
              <>
                <Button onClick={handleSave} className="h-11 px-5">
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>

                <Button variant="outline" onClick={handleCancel} className="h-11 px-5">
                  Cancel
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}