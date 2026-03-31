import { useState } from "react";
import { AlertCircle, Upload, FileText, X, History, FileUp, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DocumentItem, DocumentSubmission, Remark } from "@/types/onboarding.types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusIcon } from "./shared/StatusIcon";
import { StatusBadge } from "./shared/StatusBadge";
import { RemarksSection } from "./shared/RemarksSection";
import { formatFileSize, validateFile } from "./shared/utils";

interface DocumentUploadProps {
  documents: DocumentItem[];
  remarks: Remark[];
  onUpdate: (docs: DocumentItem[]) => void;
}

const ALLOWED_FILE_TYPES = new Set(["application/pdf"]);

export function DocumentUpload({ documents, remarks, onUpdate }: Readonly<DocumentUploadProps>) {
  const [uploadErrors, setUploadErrors] = useState<{ [key: string]: string }>({});

  const handleFileUpload = (onboardingItemId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const error = validateFile(file, ALLOWED_FILE_TYPES, "Invalid file type. Only PDF files are allowed.");
    if (error) {
      setUploadErrors({ ...uploadErrors, [onboardingItemId]: error });
      event.target.value = "";
      return;
    }

    setUploadErrors({ ...uploadErrors, [onboardingItemId]: "" });

    const newSubmission: DocumentSubmission = {
      submission_id: Date.now().toString(),
      onboarding_item_id: onboardingItemId,
      file_url: "",
      file_name: file.name,
      file_size_bytes: file.size,
      file_type: file.type,
      is_proof_of_receipt: false,
      status: "uploaded",
      uploaded_at: new Date().toISOString(),
    };

    const updatedDocuments = documents.map((doc) => {
      if (doc.onboarding_item_id === onboardingItemId) {
        return {
          ...doc,
          files: [newSubmission],
          upload_history: [...doc.upload_history, newSubmission],
          status: "pending" as const,
        };
      }
      return doc;
    });

    onUpdate(updatedDocuments);
    event.target.value = "";
  };

  const handleCancelUpload = (onboardingItemId: string) => {
    const updatedDocuments = documents.map((doc) => {
      if (doc.onboarding_item_id === onboardingItemId) {
        return {
          ...doc,
          files: [],
          status: "pending" as const,
        };
      }
      return doc;
    });

    onUpdate(updatedDocuments);
  };

  const handleSubmitForReview = (onboardingItemId: string) => {
    const updatedDocuments = documents.map((doc) => {
      if (doc.onboarding_item_id === onboardingItemId && doc.files.length > 0) {
        return {
          ...doc,
          status: "for-review" as const,
        };
      }
      return doc;
    });

    onUpdate(updatedDocuments);
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[35%]">Document</TableHead>
            <TableHead className="w-[25%]">Current File</TableHead>
            <TableHead className="w-[15%]">Status</TableHead>
            <TableHead className="w-[25%]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.onboarding_item_id}>
              <TableCell>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="font-medium">{doc.title}</span>
                    {doc.is_required && <span className="text-red-600 font-bold">*</span>}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {doc.files.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-blue-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{doc.files[0].file_name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(doc.files[0].file_size_bytes)}</p>
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-slate-400">No file uploaded</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <StatusIcon status={doc.status} />
                  <StatusBadge status={doc.status} />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {(doc.status === "pending" || doc.status === "rejected") && doc.files.length === 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById(`file-${doc.onboarding_item_id}`)?.click()}
                      >
                        <Upload className="size-3 mr-1" />
                        Upload
                      </Button>
                      <input
                        id={`file-${doc.onboarding_item_id}`}
                        type="file"
                        className="hidden"
                        accept=".pdf"
                        onChange={(e) => handleFileUpload(doc.onboarding_item_id, e)}
                      />
                    </>
                  )}

                  {doc.status === "pending" && doc.files.length > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelUpload(doc.onboarding_item_id)}
                      >
                        <X className="size-3 mr-1" />
                        Cancel
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleSubmitForReview(doc.onboarding_item_id)}
                      >
                        Submit
                      </Button>
                    </>
                  )}

                  {(doc.status === "rejected" || doc.status === "for-review") && doc.files.length > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          handleCancelUpload(doc.onboarding_item_id);
                          setTimeout(() => {
                            document.getElementById(`file-${doc.onboarding_item_id}`)?.click();
                          }, 100);
                        }}
                      >
                        <FileUp className="size-3 mr-1" />
                        Reupload
                      </Button>
                      <input
                        id={`file-${doc.onboarding_item_id}`}
                        type="file"
                        className="hidden"
                        accept=".pdf"
                        onChange={(e) => handleFileUpload(doc.onboarding_item_id, e)}
                      />
                    </>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {doc.upload_history.length > 0 && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <History className="size-3 mr-2" />
                              View History
                            </DropdownMenuItem>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Upload History - {doc.title}</DialogTitle>
                              <DialogDescription>View all previous uploads for this document</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="max-h-100">
                              <div className="space-y-2">
                                {doc.upload_history.slice().reverse().map((file) => (
                                  <div key={file.submission_id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
                                    <FileText className="size-6 text-blue-600" />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">{file.file_name}</p>
                                      <p className="text-xs text-slate-500">
                                        {formatFileSize(file.file_size_bytes)} • {new Date(file.uploaded_at).toLocaleString()}
                                      </p>
                                    </div>
                                    <StatusBadge status={file.status} />
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {Object.entries(uploadErrors).map(([docId, error]) =>
        error && (
          <Alert key={docId} variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )
      )}

      <RemarksSection remarks={remarks} />

      <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded border">
        <strong>File Requirements:</strong> PDF format only. Maximum file size: 10MB. Only one file per document.
      </div>
    </div>
  );
}
