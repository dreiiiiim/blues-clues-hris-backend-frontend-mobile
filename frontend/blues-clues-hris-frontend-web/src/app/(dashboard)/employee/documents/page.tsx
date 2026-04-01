"use client";

import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  FileCheck,
  ShieldCheck,
  Landmark,
  X,
  CheckCircle2,
  Clock3,
  Files,
} from "lucide-react";

type UploadedDocument = {
  name: string;
  size: number;
  uploadedAt: string;
};

const REQUIRED_DOCUMENTS = [
  {
    id: "government-id",
    title: "Government ID",
    description: "Upload a valid government-issued identification card.",
    accepted: ".pdf,.png,.jpg,.jpeg",
    icon: ShieldCheck,
  },
  {
    id: "tax-form",
    title: "Tax Form",
    description: "Submit your required tax-related onboarding document.",
    accepted: ".pdf,.png,.jpg,.jpeg,.doc,.docx",
    icon: FileText,
  },
  {
    id: "employment-contract",
    title: "Signed Employment Contract",
    description: "Upload your signed employment contract for verification.",
    accepted: ".pdf,.doc,.docx",
    icon: FileCheck,
  },
  {
    id: "bank-details",
    title: "Bank Details / Payroll Form",
    description: "Provide your payroll-related bank document or form.",
    accepted: ".pdf,.png,.jpg,.jpeg,.doc,.docx",
    icon: Landmark,
  },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EmployeeDocumentsPage() {
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, UploadedDocument>>({});
  const [statusMessage, setStatusMessage] = useState("");
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const uploadedCount = useMemo(() => Object.keys(uploadedDocs).length, [uploadedDocs]);
  const pendingCount = REQUIRED_DOCUMENTS.length - uploadedCount;

  const handleChooseFile = (docId: string) => {
    inputRefs.current[docId]?.click();
  };

  const handleFileChange = (docId: string, file: File | null) => {
    if (!file) return;

    setUploadedDocs((prev) => ({
      ...prev,
      [docId]: {
        name: file.name,
        size: file.size,
        uploadedAt: new Date().toLocaleString(),
      },
    }));

    setStatusMessage("Document uploaded successfully.");
  };

  const handleRemoveFile = (docId: string) => {
    setUploadedDocs((prev) => {
      const updated = { ...prev };
      delete updated[docId];
      return updated;
    });

    setStatusMessage("Uploaded document removed.");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-[#1e3a8a] text-white p-8 shadow-sm">
        <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-white/10 -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 right-16 h-24 w-24 rounded-full bg-white/10 translate-y-1/2" />
        <div className="relative z-10">
          <p className="text-sm uppercase tracking-[0.2em] text-white/70 font-semibold mb-2">
            Employee Documents
          </p>
          <h1 className="text-3xl font-bold mb-2">Upload your required documents</h1>
          <p className="text-sm text-white/80 max-w-2xl">
            Submit your onboarding and employment-related files here. This is a UI prototype for employee document uploads.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Files className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Required</p>
              <p className="text-2xl font-bold text-gray-900">{REQUIRED_DOCUMENTS.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-green-50 text-green-700 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Uploaded</p>
              <p className="text-2xl font-bold text-gray-900">{uploadedCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {statusMessage && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-sm text-blue-700">{statusMessage}</p>
        </div>
      )}

      <Card className="rounded-2xl border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-900">
            Required Employee Documents
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {REQUIRED_DOCUMENTS.map((doc) => {
            const uploaded = uploadedDocs[doc.id];
            const Icon = doc.icon;

            return (
              <div
                key={doc.id}
                className="rounded-2xl border border-gray-200 p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">{doc.title}</h3>

                      {uploaded ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          Uploaded
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                          Pending
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-gray-500">{doc.description}</p>
                    <p className="text-xs text-gray-400">Accepted files: {doc.accepted}</p>

                    {uploaded && (
                      <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-3 mt-2">
                        <p className="text-sm font-medium text-gray-900">{uploaded.name}</p>
                        <p className="text-xs text-gray-500">
                          {formatBytes(uploaded.size)} • Uploaded {uploaded.uploadedAt}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={(el) => {
                      inputRefs.current[doc.id] = el;
                    }}
                    type="file"
                    accept={doc.accepted}
                    className="hidden"
                    onChange={(e) => handleFileChange(doc.id, e.target.files?.[0] || null)}
                  />

                  <Button onClick={() => handleChooseFile(doc.id)} className="h-10 px-4">
                    <Upload className="h-4 w-4 mr-2" />
                    {uploaded ? "Replace File" : "Upload File"}
                  </Button>

                  {uploaded && (
                    <Button
                      variant="outline"
                      onClick={() => handleRemoveFile(doc.id)}
                      className="h-10 px-4"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}