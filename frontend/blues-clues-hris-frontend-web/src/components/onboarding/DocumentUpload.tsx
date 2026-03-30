import { useState } from "react";
import { AlertCircle, Upload, FileText, ExternalLink, X, History, FileUp, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DocumentItem, FileUpload } from "@/types/onboarding.types";
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
  onUpdate: (docs: DocumentItem[]) => void;
}

const ALLOWED_FILE_TYPES = new Set(["application/pdf"]);

export function DocumentUpload({ documents, onUpdate }: Readonly<DocumentUploadProps>) {
  const [uploadErrors, setUploadErrors] = useState<{ [key: string]: string }>({});
  const [viewingSample, setViewingSample] = useState<{ title: string; url: string } | null>(null);

  const handleFileUpload = (documentId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const error = validateFile(file, ALLOWED_FILE_TYPES, "Invalid file type. Only PDF files are allowed.");
    if (error) {
      setUploadErrors({ ...uploadErrors, [documentId]: error });
      event.target.value = ""; // Reset input
      return;
    }

    setUploadErrors({ ...uploadErrors, [documentId]: "" });

    const newFile: FileUpload = {
      id: Date.now().toString(),
      name: file.name,
      size: file.size,
      uploadDate: new Date(),
      status: "uploaded",
    };

    const updatedDocuments = documents.map((doc) => {
      if (doc.id === documentId) {
        return {
          ...doc,
          files: [newFile], // Only one file allowed
          uploadHistory: [...doc.uploadHistory, newFile],
          status: "pending" as const, // Stay pending until submitted
        };
      }
      return doc;
    });

    onUpdate(updatedDocuments);
    event.target.value = ""; // Reset input
  };

  const handleCancelUpload = (documentId: string) => {
    const updatedDocuments = documents.map((doc) => {
      if (doc.id === documentId) {
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

  const handleSubmitForReview = (documentId: string) => {
    const updatedDocuments = documents.map((doc) => {
      if (doc.id === documentId && doc.files.length > 0) {
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
            <TableRow key={doc.id}>
              <TableCell>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="font-medium">{doc.title}</span>
                    {doc.required && <span className="text-red-600 font-bold">*</span>}
                  </div>
                  {doc.feedback && (
                    <p className="text-xs text-red-600">{doc.feedback}</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {doc.files.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-blue-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{doc.files[0].name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(doc.files[0].size)}</p>
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
                  {/* Primary actions based on status */}
                  {(doc.status === "pending" || doc.status === "rejected") && doc.files.length === 0 && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => document.getElementById(`file-${doc.id}`)?.click()}
                      >
                        <Upload className="size-3 mr-1" />
                        Upload
                      </Button>
                      <input
                        id={`file-${doc.id}`}
                        type="file"
                        className="hidden"
                        accept=".pdf"
                        onChange={(e) => handleFileUpload(doc.id, e)}
                      />
                    </>
                  )}

                  {/* Cancel and Submit when file is uploaded but not submitted */}
                  {doc.status === "pending" && doc.files.length > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelUpload(doc.id)}
                      >
                        <X className="size-3 mr-1" />
                        Cancel
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleSubmitForReview(doc.id)}
                      >
                        Submit
                      </Button>
                    </>
                  )}

                  {/* Reupload for rejected or for-review status */}
                  {(doc.status === "rejected" || doc.status === "for-review") && doc.files.length > 0 && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          handleCancelUpload(doc.id);
                          setTimeout(() => {
                            document.getElementById(`file-${doc.id}`)?.click();
                          }, 100);
                        }}
                      >
                        <FileUp className="size-3 mr-1" />
                        Reupload
                      </Button>
                      <input
                        id={`file-${doc.id}`}
                        type="file"
                        className="hidden"
                        accept=".pdf"
                        onChange={(e) => handleFileUpload(doc.id, e)}
                      />
                    </>
                  )}

                  {/* More actions dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {doc.sampleUrl && (
                        <DropdownMenuItem onClick={() => setViewingSample({ title: doc.title, url: doc.sampleUrl! })}>
                          <ExternalLink className="size-3 mr-2" />
                          View Sample
                        </DropdownMenuItem>
                      )}
                      {doc.uploadHistory.length > 0 && (
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
                                {doc.uploadHistory.slice().reverse().map((file) => (
                                  <div key={file.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
                                    <FileText className="size-6 text-blue-600" />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">{file.name}</p>
                                      <p className="text-xs text-slate-500">
                                        {formatFileSize(file.size)} • {file.uploadDate.toLocaleString()}
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

      {/* Upload Errors */}
      {Object.entries(uploadErrors).map(([docId, error]) => 
        error && (
          <Alert key={docId} variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )
      )}

      {/* Remarks Section */}
      <RemarksSection items={documents} />

      <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded border">
        <strong>File Requirements:</strong> PDF format only. Maximum file size: 10MB. Only one file per document.
      </div>

      {/* Sample Document Viewer */}
      {viewingSample && (
        <Dialog open={true} onOpenChange={() => setViewingSample(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Sample Document - {viewingSample.title}</DialogTitle>
              <DialogDescription>View the sample document for reference</DialogDescription>
            </DialogHeader>
            <div className="w-full max-h-150 overflow-auto bg-slate-50 rounded-lg p-4">
              <img 
                src={viewingSample.url} 
                alt={`Sample ${viewingSample.title}`}
                className="w-full h-auto rounded shadow-lg"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}