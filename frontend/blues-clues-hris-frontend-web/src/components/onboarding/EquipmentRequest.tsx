import { useState } from "react";
import { CheckCircle, AlertCircle, Upload, FileText, Eye, MapPin, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EquipmentItem, FileUpload } from "@/types/onboarding.types";
import { StatusIcon } from "./shared/StatusIcon";
import { StatusBadge } from "./shared/StatusBadge";
import { RemarksSection } from "./shared/RemarksSection";
import { formatFileSize, validateFile as validateFileUtil } from "./shared/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface EquipmentRequestProps {
  equipment: EquipmentItem[];
  onUpdateEquipment: (equipment: EquipmentItem[]) => void;
}

const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function EquipmentRequest({ equipment, onUpdateEquipment }: Readonly<EquipmentRequestProps>) {
  const [uploadErrors, setUploadErrors] = useState<{ [key: string]: string }>({});
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<"office" | "delivery">("office");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const handleCheckboxChange = (equipmentId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems([...selectedItems, equipmentId]);
    } else {
      setSelectedItems(selectedItems.filter(id => id !== equipmentId));
    }
    
    const updatedEquipment = equipment.map((item) => {
      if (item.id === equipmentId) {
        return {
          ...item,
          quantity: checked ? 1 : 0,
        };
      }
      return item;
    });
    onUpdateEquipment(updatedEquipment);
  };

  const handleOpenBulkDeliveryDialog = () => {
    if (selectedItems.length === 0) return;
    setDeliveryDialogOpen(true);
  };

  const handleBulkSubmitRequest = () => {
    if (deliveryMethod === "delivery" && !deliveryAddress.trim()) {
      alert("Please provide a delivery address");
      return;
    }

    const updatedEquipment = equipment.map((item) => {
      if (selectedItems.includes(item.id) && item.quantity > 0) {
        return {
          ...item,
          status: "for-review" as const,
          deliveryMethod,
          deliveryAddress: deliveryMethod === "delivery" ? deliveryAddress : undefined,
        };
      }
      return item;
    });

    onUpdateEquipment(updatedEquipment);
    setDeliveryDialogOpen(false);
    setDeliveryAddress("");
    setSelectedItems([]);
  };

  const handleProofUpload = (equipmentId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const error = validateFileUtil(file, ALLOWED_FILE_TYPES, "Invalid file type. Only PDF, JPG, PNG, DOC, and DOCX files are allowed.");
    if (error) {
      setUploadErrors({ ...uploadErrors, [equipmentId]: error });
      return;
    }

    setUploadErrors({ ...uploadErrors, [equipmentId]: "" });

    const newFile: FileUpload = {
      id: Date.now().toString(),
      name: file.name,
      size: file.size,
      uploadDate: new Date(),
      status: "uploaded",
    };

    const updatedEquipment = equipment.map((item) => {
      if (item.id === equipmentId) {
        return {
          ...item,
          proofOfReceipt: [...(item.proofOfReceipt || []), newFile],
        };
      }
      return item;
    });

    onUpdateEquipment(updatedEquipment);
  };

  const handleConfirmReceipt = (equipmentId: string) => {
    const updatedEquipment = equipment.map((item) => {
      if (item.id === equipmentId && (item.proofOfReceipt?.length || 0) > 0) {
        return {
          ...item,
          status: "approved" as const,
        };
      }
      return item;
    });
    onUpdateEquipment(updatedEquipment);
  };

  const pendingSelectedCount = equipment.filter(
    item => selectedItems.includes(item.id) && item.quantity > 0 && (item.status === "pending" || item.status === "submitted")
  ).length;

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[5%]">Request</TableHead>
            <TableHead className="w-[20%]">Equipment</TableHead>
            <TableHead className="w-[25%]">Description</TableHead>
            <TableHead className="w-[12%]">Delivery Method</TableHead>
            <TableHead className="w-[10%]">Status</TableHead>
            <TableHead className="w-[13%]">Proof of Receipt</TableHead>
            <TableHead className="w-[15%]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {equipment.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                {(item.status === "pending" || item.status === "submitted") && (
                  <Checkbox
                    id={`equip-${item.id}`}
                    checked={item.quantity === 1}
                    onCheckedChange={(checked) => handleCheckboxChange(item.id, checked as boolean)}
                  />
                )}
                {(item.status === "for-review" || item.status === "issued" || item.status === "approved") && item.quantity === 1 && (
                  <CheckCircle className="size-4 text-green-600" />
                )}
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.title}</span>
                    {item.required && <span className="text-red-600 font-bold">*</span>}
                  </div>
                  {item.feedback && (
                    <p className="text-xs text-red-600">{item.feedback}</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-slate-600">{item.description}</span>
              </TableCell>
              <TableCell>
                {item.deliveryMethod ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-sm">
                      {item.deliveryMethod === "office" ? (
                        <>
                          <MapPin className="size-3 text-blue-600" />
                          <span>Office Pickup</span>
                        </>
                      ) : (
                        <>
                          <Truck className="size-3 text-green-600" />
                          <span>Delivery</span>
                        </>
                      )}
                    </div>
                    {item.deliveryMethod === "delivery" && item.deliveryAddress && (
                      <p className="text-xs text-slate-500 line-clamp-2">{item.deliveryAddress}</p>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-slate-400">-</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <StatusIcon status={item.status} />
                  <StatusBadge status={item.status} />
                </div>
              </TableCell>
              <TableCell>
                {item.status === "issued" && (
                  <div className="space-y-2">
                    {(item.proofOfReceipt?.length || 0) > 0 ? (
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-blue-600" />
                        <span className="text-sm">{item.proofOfReceipt?.length} file(s)</span>
                        {item.proofOfReceipt && item.proofOfReceipt.length > 0 && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 px-2">
                                <Eye className="size-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Proof of Receipt - {item.title}</DialogTitle>
                                <DialogDescription>Uploaded proof documents</DialogDescription>
                              </DialogHeader>
                              <ScrollArea className="max-h-100">
                                <div className="space-y-2">
                                  {item.proofOfReceipt.map((file) => (
                                    <div key={file.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
                                      <FileText className="size-6 text-blue-600" />
                                      <div className="flex-1">
                                        <p className="text-sm font-medium">{file.name}</p>
                                        <p className="text-xs text-slate-500">
                                          {formatFileSize(file.size)} • {file.uploadDate.toLocaleString()}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    ) : (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => document.getElementById(`proof-${item.id}`)?.click()}
                        >
                          <Upload className="size-3 mr-1" />
                          Upload
                        </Button>
                        <input
                          id={`proof-${item.id}`}
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleProofUpload(item.id, e)}
                        />
                      </>
                    )}
                  </div>
                )}
                {(item.status === "approved" && (item.proofOfReceipt?.length || 0) > 0) && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="size-4 text-green-600" />
                    <span className="text-sm text-green-600">Confirmed</span>
                  </div>
                )}
                {(item.status !== "issued" && item.status !== "approved") && (
                  <span className="text-sm text-slate-400">-</span>
                )}
              </TableCell>
              <TableCell>
                {item.status === "issued" && (item.proofOfReceipt?.length || 0) > 0 && (
                  <Button
                    onClick={() => handleConfirmReceipt(item.id)}
                    size="sm"
                    variant="default"
                  >
                    Confirm Receipt
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Delivery Method Dialog */}
      <Dialog open={deliveryDialogOpen} onOpenChange={(open) => !open && setDeliveryDialogOpen(false)}>
        <DialogContent className="sm:max-w-125">
          <DialogHeader>
            <DialogTitle>Choose Delivery Method</DialogTitle>
            <DialogDescription>
              {pendingSelectedCount > 0 && (
                <span>Submitting {pendingSelectedCount} {pendingSelectedCount === 1 ? 'item' : 'items'}. </span>
              )}
              How would you like to receive this equipment?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <Label>Delivery Method</Label>
              
              {/* Office Pickup Option */}
              <button
                type="button"
                className={`w-full text-left border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  deliveryMethod === "office"
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
                onClick={() => setDeliveryMethod("office")}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 size-5 rounded-full border-2 flex items-center justify-center ${
                    deliveryMethod === "office" ? "border-blue-500" : "border-slate-300"
                  }`}>
                    {deliveryMethod === "office" && (
                      <div className="size-2.5 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="size-4 text-blue-600" />
                      <span className="font-semibold">Claim in Office</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      Pick up your equipment from our office location during business hours
                    </p>
                  </div>
                </div>
              </button>

              {/* Delivery Option */}
              <button
                type="button"
                className={`w-full text-left border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  deliveryMethod === "delivery"
                    ? "border-green-500 bg-green-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
                onClick={() => setDeliveryMethod("delivery")}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 size-5 rounded-full border-2 flex items-center justify-center ${
                    deliveryMethod === "delivery" ? "border-green-500" : "border-slate-300"
                  }`}>
                    {deliveryMethod === "delivery" && (
                      <div className="size-2.5 rounded-full bg-green-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Truck className="size-4 text-green-600" />
                      <span className="font-semibold">Request Delivery</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      Have the equipment delivered to your preferred address
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {/* Delivery Address Field */}
            {deliveryMethod === "delivery" && (
              <div className="space-y-2">
                <Label htmlFor="delivery-address">Delivery Address *</Label>
                <Textarea
                  id="delivery-address"
                  placeholder="Enter your complete delivery address..."
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-slate-500">
                  Please provide a complete address including street, city, and postal code
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliveryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkSubmitRequest}>
              Confirm & Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Errors */}
      {Object.entries(uploadErrors).map(([equipId, error]) => 
        error && (
          <Alert key={equipId} variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )
      )}

      {/* Remarks Section */}
      <RemarksSection items={equipment} />

      {/* Submit Selected Items Button */}
      {pendingSelectedCount > 0 && (
        <div className="flex items-center justify-between bg-blue-50 border-2 border-blue-200 p-4 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="size-5 text-blue-600" />
            <div>
              <p className="font-medium text-blue-900">
                {pendingSelectedCount} {pendingSelectedCount === 1 ? 'item' : 'items'} selected
              </p>
              <p className="text-xs text-blue-700">
                Submit your equipment requests to continue
              </p>
            </div>
          </div>
          <Button onClick={handleOpenBulkDeliveryDialog} size="lg">
            Submit Selected Items
          </Button>
        </div>
      )}

      <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded border">
        <strong>Note:</strong> When equipment status is "Issued", please upload proof of receipt (photo/document) and click "Confirm Receipt" to complete the process.
      </div>
    </div>
  );
}