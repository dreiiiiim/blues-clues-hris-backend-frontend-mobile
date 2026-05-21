"use client";

import { useEffect, useState, useRef } from "react";
import { LogOut, CheckCircle2, Clock, Loader2, Upload, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  getMyOffboardingCase, 
  submitResignation, 
  acknowledgeChecklistItem,
  type OffboardingCaseDetail,
} from "@/lib/offboardingApi";
import { getUserInfo, getAccessToken, parseJwt, type StoredUser } from "@/lib/authStorage";

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: Readonly<{ status: string }>) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    'Submitted': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Submitted' },
    'Manager_Acknowledged': { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Manager Review' },
    'HR_Accepted': { bg: 'bg-purple-100', text: 'text-purple-700', label: 'HR Processing' },
    'Completed': { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
    'Rejected': { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
  };
  
  const c = config[status] || config['Submitted'];
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function EmployeeOffboardingPage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [caseDetail, setCaseDetail] = useState<OffboardingCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resignation form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    reason: '',
    last_working_day: '',
    resignation_letter: '',
    document_url: '',
    document_name: '',
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Acknowledgement state
  const [acknowledgingItemId, setAcknowledgingItemId] = useState<string | null>(null);
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUploadProgress, setProofUploadProgress] = useState(0);
  const [selectedItemForProof, setSelectedItemForProof] = useState<string | null>(null);
  const proofFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedUser = getUserInfo();
    
    // If user_id is missing, try to get it from the JWT
    if (storedUser && !storedUser.user_id) {
      const token = getAccessToken();
      if (token) {
        const payload = parseJwt(token);
        if (payload?.sub_userid) {
          storedUser.user_id = payload.sub_userid;
        }
      }
    }
    
    setUser(storedUser);
    fetchCase();
  }, []);

  async function fetchCase() {
    try {
      setLoading(true);
      const data = await getMyOffboardingCase();
      setCaseDetail(data);
    } catch (err) {
      console.error('Failed to fetch offboarding case:', err);
      toast.error("Failed to load offboarding details.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(file: File) {
    try {
      setUploadedFile(file);
      setUploadProgress(0);

      // Simulate upload progress
      const interval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 25, 90));
      }, 300);

      // Placeholder upload flow until storage integration is connected.
      await new Promise(resolve => setTimeout(resolve, 1500));
      clearInterval(interval);
      setUploadProgress(100);

      const mockUrl = `https://example.com/uploads/${file.name}`;
      setFormData(prev => ({
        ...prev,
        document_url: mockUrl,
        document_name: file.name,
      }));

      toast.success('Document uploaded successfully');
    } catch {
      toast.error('Failed to upload document');
    }
  }

  async function handleSubmitResignation() {
    if (!user) {
      toast.error('User information not loaded. Please refresh the page.');
      return;
    }

    if (!user.user_id) {
      toast.error('Unable to retrieve your user ID. Please log out and log back in.');
      return;
    }

    if (!formData.reason || !formData.last_working_day || !formData.document_url) {
      toast.error('Please fill all required fields and upload a document');
      return;
    }

    setSubmitting(true);
    try {
      await submitResignation({
        employee_id: user.user_id,
        reason: formData.reason,
        last_working_day: formData.last_working_day,
        resignation_letter: formData.resignation_letter || null,
        document_url: formData.document_url,
        document_name: formData.document_name,
      });

      toast.success('Resignation submitted successfully');
      setShowForm(false);
      setFormData({ reason: '', last_working_day: '', resignation_letter: '', document_url: '', document_name: '' });
      setUploadedFile(null);
      setUploadProgress(0);
      await fetchCase();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit resignation');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAcknowledgeItem(itemId: string) {
    setSelectedItemForProof(itemId);
    setProofFile(null);
    setProofUploadProgress(0);
    setProofModalOpen(true);
  }

  async function handleProofFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be less than 10MB');
      return;
    }
    
    setProofFile(file);
  }

  async function handleSubmitProof() {
    if (!proofFile || !selectedItemForProof || !caseDetail) {
      toast.error('Please select a file');
      return;
    }

    setAcknowledgingItemId(selectedItemForProof);
    try {
      setProofUploadProgress(0);

      // Simulate upload progress
      const interval = setInterval(() => {
        setProofUploadProgress(prev => Math.min(prev + 25, 90));
      }, 300);

      // Placeholder upload flow until storage integration is connected.
      await new Promise(resolve => setTimeout(resolve, 1500));
      clearInterval(interval);
      setProofUploadProgress(100);

      // Placeholder proof URL until storage integration is connected.
      const mockProofUrl = `https://offboarding-proof.example.com/${Date.now()}_${proofFile.name}`;

      // After proof uploaded, acknowledge the item with proof URL
      await acknowledgeChecklistItem(caseDetail.case_id, selectedItemForProof, mockProofUrl);
      
      toast.success('Proof submitted for HR review');
      setProofModalOpen(false);
      setProofFile(null);
      setProofUploadProgress(0);
      setSelectedItemForProof(null);
      await fetchCase();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to acknowledge item');
    } finally {
      setAcknowledgingItemId(null);
    }
  }

  const checklistItems = caseDetail?.checklist_items ?? [];
  const completedChecklistCount = checklistItems.filter((item) => item.status === "Verified").length;
  const hasChecklist = checklistItems.length > 0;

  const selectedChecklistStatus = (status: string) => {
    if (status === "Verified") return "Completed";
    if (status === "Submitted") return "Submitted for HR review";
    if (status === "Disputed") return "Needs resubmission";
    return "Pending acknowledgement";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="size-8 animate-spin mx-auto text-blue-600" />
          <p className="text-slate-600">Loading offboarding information...</p>
        </div>
      </div>
    );
  }

  // No active case
  if (!caseDetail) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Offboarding</h1>
            <p className="text-slate-600 mt-1">Manage your departure from the company</p>
          </div>

          {showForm ? (
            <Card>
              <CardHeader>
                <CardTitle>Submit Resignation</CardTitle>
                <CardDescription>Please provide your resignation details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="last-working-day" className="text-sm font-semibold">Last Working Day *</label>
                  <Input
                    id="last-working-day"
                    type="date"
                    value={formData.last_working_day}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_working_day: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="resignation-reason" className="text-sm font-semibold">Reason for Resignation *</label>
                  <Textarea
                    id="resignation-reason"
                    placeholder="Please explain your reason for resigning..."
                    value={formData.reason}
                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="resignation-letter" className="text-sm font-semibold">Resignation Letter (Optional)</label>
                  <Textarea
                    id="resignation-letter"
                    placeholder="Your formal resignation letter..."
                    value={formData.resignation_letter}
                    onChange={(e) => setFormData(prev => ({ ...prev, resignation_letter: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="resignation-document" className="text-sm font-semibold">Upload Document *</label>
                  <input
                    id="resignation-document"
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        void handleFileUpload(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  
                  {uploadedFile ? (
                    <div className="border-2 border-green-200 bg-green-50 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="size-5 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-green-900">{uploadedFile.name}</p>
                          <p className="text-xs text-green-700">{(uploadedFile.size / 1024).toFixed(2)} KB</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setUploadedFile(null);
                          setFormData(prev => ({ ...prev, document_url: '', document_name: '' }));
                          setUploadProgress(0);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      <Upload className="size-6 mx-auto mb-2 text-slate-400" />
                      <p className="text-sm font-medium text-slate-700">Click to upload or drag and drop</p>
                      <p className="text-xs text-slate-500 mt-1">PDF, DOC, DOCX, JPG, PNG up to 10MB</p>
                    </button>
                  )}
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleSubmitResignation}
                    disabled={submitting}
                    className="flex-1"
                  >
                    {submitting && <Loader2 className="size-4 mr-2 animate-spin" />}
                    {submitting ? 'Submitting...' : 'Submit Resignation'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setFormData({ reason: '', last_working_day: '', resignation_letter: '', document_url: '', document_name: '' });
                      setUploadedFile(null);
                    }}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="rounded-full bg-slate-100 p-6">
                    <LogOut className="size-16 text-slate-400" />
                  </div>
                </div>
                <CardTitle>No Active Offboarding</CardTitle>
                <CardDescription>
                  You don't currently have an active offboarding case. Submit your resignation to get started.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setShowForm(true)} className="w-full">
                  <LogOut className="size-4 mr-2" />
                  Submit Resignation
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Active case view
  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Offboarding Progress</h1>
          <p className="text-slate-600 mt-1">Track your offboarding process</p>
        </div>

        {/* Status Card */}
        <Card className="border-l-4 border-l-blue-600">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Case Status</CardTitle>
                <CardDescription className="mt-1">
                  Submitted on {new Date(caseDetail.created_at).toLocaleDateString()}
                </CardDescription>
              </div>
              <StatusBadge status={caseDetail.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Type</p>
                <p className="text-sm font-medium mt-1">{caseDetail.offboarding_type}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Last Working Day</p>
                <p className="text-sm font-medium mt-1">{new Date(caseDetail.last_working_day).toLocaleDateString()}</p>
              </div>
            </div>
            
            {caseDetail.resignation_details && (
              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Resignation Reason</p>
                <p className="text-sm text-slate-700">{caseDetail.resignation_details.reason}</p>
                {caseDetail.resignation_details.document_name && (
                  <a
                    href={caseDetail.resignation_details.document_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-3 text-xs font-medium text-blue-600 hover:underline"
                  >
                    <FileText className="size-3" />
                    {caseDetail.resignation_details.document_name}
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Checklist */}
        {hasChecklist && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-blue-600" />
                Offboarding Checklist
              </CardTitle>
              <CardDescription>
                {completedChecklistCount} of {checklistItems.length} completed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {checklistItems.map(item => (
                    <div key={item.item_id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        {item.status === 'Verified' ? (
                          <CheckCircle2 className="size-5 text-green-600 shrink-0" />
                        ) : (
                          <div className="size-5 rounded-full border-2 border-slate-300 shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{item.item_name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {selectedChecklistStatus(item.status)}
                          </p>
                        </div>
                      </div>
                      {(item.status === 'Pending' || item.status === 'Disputed') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAcknowledgeItem(item.item_id)}
                          disabled={acknowledgingItemId === item.item_id}
                        >
                          {acknowledgingItemId === item.item_id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            'Acknowledge'
                          )}
                        </Button>
                      )}
                    </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Access */}
        {caseDetail.system_access && caseDetail.system_access.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>System Access Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {caseDetail.system_access.map(system => (
                  <div key={system.access_id} className="flex items-center justify-between p-3 border rounded-lg">
                    <p className="text-sm font-medium">{system.system_name}</p>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      system.status === 'Active' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {system.status}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-5 text-blue-600" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="size-3 rounded-full bg-blue-600" />
                  <div className="w-0.5 h-12 bg-slate-200" />
                </div>
                <div>
                  <p className="text-sm font-medium">Resignation Submitted</p>
                  <p className="text-xs text-slate-500">{new Date(caseDetail.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`size-3 rounded-full ${['Manager_Acknowledged', 'HR_Accepted', 'Completed'].includes(caseDetail.status) ? 'bg-blue-600' : 'bg-slate-300'}`} />
                  {['HR_Accepted', 'Completed'].includes(caseDetail.status) && <div className="w-0.5 h-12 bg-slate-200" />}
                </div>
                <div>
                  <p className="text-sm font-medium">Manager Review</p>
                  <p className="text-xs text-slate-500">Pending manager acknowledgement</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`size-3 rounded-full ${['HR_Accepted', 'Completed'].includes(caseDetail.status) ? 'bg-blue-600' : 'bg-slate-300'}`} />
                  {caseDetail.status === 'Completed' && <div className="w-0.5 h-12 bg-slate-200" />}
                </div>
                <div>
                  <p className="text-sm font-medium">HR Processing</p>
                  <p className="text-xs text-slate-500">HR review and access revocation</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`size-3 rounded-full ${caseDetail.status === 'Completed' ? 'bg-green-600' : 'bg-slate-300'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium">Completed</p>
                  <p className="text-xs text-slate-500">Final settlement and clearance</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Proof Upload Modal */}
      {proofModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Upload Proof of Return</CardTitle>
              <CardDescription>
                Please upload a photo or document proving you returned this item
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File Upload Area */}
              <button
                type="button"
                className="w-full border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-slate-400 transition-colors"
                onClick={() => proofFileInputRef.current?.click()}
              >
                <Upload className="size-8 mx-auto text-slate-400 mb-2" />
                <p className="text-sm font-medium text-slate-900">
                  {proofFile ? proofFile.name : 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  PNG, JPG, PDF up to 10MB
                </p>
              </button>

              <input
                ref={proofFileInputRef}
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,application/pdf"
                onChange={handleProofFileChange}
              />

              {/* Upload Progress */}
              {proofUploadProgress > 0 && proofUploadProgress < 100 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Uploading...</span>
                    <span>{proofUploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${proofUploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {proofUploadProgress === 100 && (
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded">
                  <CheckCircle2 className="size-4" />
                  Upload complete
                </div>
              )}
            </CardContent>
            <div className="border-t p-4 flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setProofModalOpen(false);
                  setProofFile(null);
                  setProofUploadProgress(0);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitProof}
                disabled={!proofFile || acknowledgingItemId !== null}
              >
                {acknowledgingItemId ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Proof'
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
