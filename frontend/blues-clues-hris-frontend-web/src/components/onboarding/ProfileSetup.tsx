import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle } from "lucide-react";
import { ProfileData } from "@/types/onboarding.types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DetailedStatusBadge } from "./shared/StatusBadge";

interface ProfileSetupProps {
  profile: ProfileData;
  onUpdate: (profile: ProfileData) => void;
}

export function ProfileSetup({ profile, onUpdate }: Readonly<ProfileSetupProps>) {
  const [formData, setFormData] = useState({
    firstName: profile.firstName || "",
    lastName: profile.lastName || "",
    middleName: profile.middleName || "",
    email: profile.email || "",
    phoneNumber: profile.phoneNumber || "",
    address: profile.address || "",
    dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.toISOString().split('T')[0] : "",
    placeOfBirth: profile.placeOfBirth || "",
    nationality: profile.nationality || "",
    civilStatus: profile.civilStatus || "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phoneNumber) {
      alert("Please fill in all required fields");
      return;
    }

    onUpdate({
      ...profile,
      firstName: formData.firstName,
      lastName: formData.lastName,
      middleName: formData.middleName,
      email: formData.email,
      phoneNumber: formData.phoneNumber,
      address: formData.address,
      dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth) : undefined,
      placeOfBirth: formData.placeOfBirth,
      nationality: formData.nationality,
      civilStatus: formData.civilStatus,
      status: "submitted",
    });

    alert("Profile submitted successfully!");
  };

  const isSubmitted = profile.status !== "pending";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Create Your Profile</h3>
          <p className="text-sm text-gray-600">Complete your profile information</p>
        </div>
        <DetailedStatusBadge status={profile.status} pendingLabel="Incomplete" />
      </div>

      {profile.status === "rejected" && profile.remarksHistory && profile.remarksHistory.length > 0 && (
        <Alert className="bg-red-50 border-red-200">
          <XCircle className="size-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Rejected:</strong> {profile.remarksHistory.at(-1)!.message}
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
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    disabled={isSubmitted}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middleName">Middle Name</Label>
                  <Input
                    id="middleName"
                    value={formData.middleName}
                    onChange={(e) => handleInputChange("middleName", e.target.value)}
                    disabled={isSubmitted}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    disabled={isSubmitted}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    disabled={isSubmitted}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number *</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                    disabled={isSubmitted}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Complete Address *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  disabled={isSubmitted}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
                    disabled={isSubmitted}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="placeOfBirth">Place of Birth</Label>
                  <Input
                    id="placeOfBirth"
                    value={formData.placeOfBirth}
                    onChange={(e) => handleInputChange("placeOfBirth", e.target.value)}
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
                  <Label htmlFor="civilStatus">Civil Status</Label>
                  <select
                    id="civilStatus"
                    value={formData.civilStatus}
                    onChange={(e) => handleInputChange("civilStatus", e.target.value)}
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

          {!isSubmitted && (
            <Button onClick={handleSubmit} className="w-full">
              <CheckCircle className="size-4 mr-2" />
              Submit Profile
            </Button>
          )}

          {/* Remarks History */}
          {profile.remarksHistory && profile.remarksHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Remarks History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {profile.remarksHistory.map((remark) => (
                    <div key={remark.id} className="border-l-4 border-blue-500 pl-4 py-2">
                      <p className="text-sm text-gray-700">{remark.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {remark.author} • {remark.date.toLocaleDateString()} {remark.date.toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}