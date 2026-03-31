import { useState } from "react";
import { saveProfile } from "@/lib/onboardingApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle } from "lucide-react";
import { ProfileData, Remark } from "@/types/onboarding.types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DetailedStatusBadge } from "./shared/StatusBadge";
import { RemarksSection } from "./shared/RemarksSection";

interface ProfileSetupProps {
  profile: ProfileData | null;
  sessionId: string;
  remarks: Remark[];
  onUpdate: (profile: ProfileData) => void;
}

const emptyProfile: Omit<ProfileData, 'profile_id' | 'session_id' | 'status'> = {
  first_name: "",
  last_name: "",
  middle_name: "",
  email_address: "",
  phone_number: "",
  complete_address: "",
  date_of_birth: "",
  place_of_birth: "",
  nationality: "",
  civil_status: "",
  contact_name: "",
  relationship: "",
  emergency_phone_number: "",
  emergency_email_address: "",
};

export function ProfileSetup({ profile, sessionId, remarks, onUpdate }: Readonly<ProfileSetupProps>) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    first_name: profile?.first_name || "",
    last_name: profile?.last_name || "",
    middle_name: profile?.middle_name || "",
    email_address: profile?.email_address || "",
    phone_number: profile?.phone_number || "",
    complete_address: profile?.complete_address || "",
    date_of_birth: profile?.date_of_birth || "",
    place_of_birth: profile?.place_of_birth || "",
    nationality: profile?.nationality || "",
    civil_status: profile?.civil_status || "",
    contact_name: profile?.contact_name || "",
    relationship: profile?.relationship || "",
    emergency_phone_number: profile?.emergency_phone_number || "",
    emergency_email_address: profile?.emergency_email_address || "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.first_name || !formData.last_name || !formData.email_address || !formData.phone_number) {
      alert("Please fill in all required fields");
      return;
    }
    if (!formData.contact_name || !formData.relationship || !formData.emergency_phone_number) {
      alert("Please fill in all required emergency contact fields");
      return;
    }

    setSaving(true);
    try {
      const result = await saveProfile(sessionId, formData);
      onUpdate(result);
      alert("Profile submitted successfully!");
    } catch {
      alert("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const profileStatus = profile?.status || "pending";
  const isSubmitted = profileStatus !== "pending" && profileStatus !== "rejected";
  const profileRemarks = remarks.filter(r => r.tab_tag === "Profile");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Create Your Profile</h3>
          <p className="text-sm text-gray-600">Complete your profile information</p>
        </div>
        <DetailedStatusBadge status={profileStatus} pendingLabel="Incomplete" />
      </div>

      {profileStatus === "rejected" && profileRemarks.length > 0 && (
        <Alert className="bg-red-50 border-red-200">
          <XCircle className="size-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Rejected:</strong> {profileRemarks.at(-1)!.remark_text}
          </AlertDescription>
        </Alert>
      )}

      <ScrollArea className="h-125 pr-4">
        <div className="space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Personal Information</CardTitle>
              <CardDescription>Enter your complete personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange("first_name", e.target.value)}
                    disabled={isSubmitted}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middle_name">Middle Name</Label>
                  <Input
                    id="middle_name"
                    value={formData.middle_name}
                    onChange={(e) => handleInputChange("middle_name", e.target.value)}
                    disabled={isSubmitted}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange("last_name", e.target.value)}
                    disabled={isSubmitted}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email_address">Email Address *</Label>
                  <Input
                    id="email_address"
                    type="email"
                    value={formData.email_address}
                    onChange={(e) => handleInputChange("email_address", e.target.value)}
                    disabled={isSubmitted}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone_number">Phone Number *</Label>
                  <Input
                    id="phone_number"
                    type="tel"
                    value={formData.phone_number}
                    onChange={(e) => handleInputChange("phone_number", e.target.value)}
                    disabled={isSubmitted}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="complete_address">Complete Address *</Label>
                <Input
                  id="complete_address"
                  value={formData.complete_address}
                  onChange={(e) => handleInputChange("complete_address", e.target.value)}
                  disabled={isSubmitted}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Date of Birth</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => handleInputChange("date_of_birth", e.target.value)}
                    disabled={isSubmitted}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="place_of_birth">Place of Birth</Label>
                  <Input
                    id="place_of_birth"
                    value={formData.place_of_birth}
                    onChange={(e) => handleInputChange("place_of_birth", e.target.value)}
                    disabled={isSubmitted}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nationality">Nationality</Label>
                  <Input
                    id="nationality"
                    value={formData.nationality}
                    onChange={(e) => handleInputChange("nationality", e.target.value)}
                    disabled={isSubmitted}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="civil_status">Civil Status</Label>
                  <select
                    id="civil_status"
                    value={formData.civil_status}
                    onChange={(e) => handleInputChange("civil_status", e.target.value)}
                    disabled={isSubmitted}
                    className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select...</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Emergency Contact Information</CardTitle>
              <CardDescription>Enter your emergency contact details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_name">Name *</Label>
                  <Input
                    id="contact_name"
                    value={formData.contact_name}
                    onChange={(e) => handleInputChange("contact_name", e.target.value)}
                    disabled={isSubmitted}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="relationship">Relationship *</Label>
                  <Input
                    id="relationship"
                    value={formData.relationship}
                    onChange={(e) => handleInputChange("relationship", e.target.value)}
                    disabled={isSubmitted}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency_phone_number">Phone Number *</Label>
                  <Input
                    id="emergency_phone_number"
                    type="tel"
                    value={formData.emergency_phone_number}
                    onChange={(e) => handleInputChange("emergency_phone_number", e.target.value)}
                    disabled={isSubmitted}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergency_email_address">Email Address</Label>
                <Input
                  id="emergency_email_address"
                  type="email"
                  value={formData.emergency_email_address}
                  onChange={(e) => handleInputChange("emergency_email_address", e.target.value)}
                  disabled={isSubmitted}
                />
              </div>
            </CardContent>
          </Card>

          {!isSubmitted && (
            <Button onClick={handleSubmit} className="w-full" disabled={saving}>
              <CheckCircle className="size-4 mr-2" />
              {saving ? "Saving..." : "Submit Profile"}
            </Button>
          )}

          <RemarksSection remarks={profileRemarks} />
        </div>
      </ScrollArea>
    </div>
  );
}
