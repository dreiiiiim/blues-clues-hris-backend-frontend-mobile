import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertCircle, Video } from "lucide-react";
import { TaskItem } from "@/types/onboarding.types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusIcon } from "./shared/StatusIcon";
import { StatusBadge } from "./shared/StatusBadge";
import { RemarksSection } from "./shared/RemarksSection";

interface TaskChecklistProps {
  tasks: TaskItem[];
  onUpdateTasks: (tasks: TaskItem[]) => void;
}

export function TaskChecklist({ tasks, onUpdateTasks }: Readonly<TaskChecklistProps>) {
  const [open, setOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [videoWatched, setVideoWatched] = useState(false);
  const [formData, setFormData] = useState<{ [key: string]: string }>({});
  const [acknowledged, setAcknowledged] = useState(false);

  const handleOpenDialog = (task: TaskItem) => {
    setSelectedTask(task);
    setOpen(true);
    // Reset completion states when opening
    setHasScrolledToBottom(task.completed || false);
    setVideoWatched(task.completed || false);
    setAcknowledged(task.completed || false);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setSelectedTask(null);
    setHasScrolledToBottom(false);
    setVideoWatched(false);
    setFormData({});
    setAcknowledged(false);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const bottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 10;
    
    if (bottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleWatchVideo = () => {
    // Simulate video watching with a timer
    setVideoWatched(true);
  };

  const handleFormChange = (fieldLabel: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldLabel]: value }));
  };

  const isFormComplete = () => {
    if (!selectedTask?.content?.fields) return false;
    
    const requiredFields = selectedTask.content.fields.filter(f => f.required);
    return requiredFields.every(field => {
      const value = formData[field.label];
      return value && value.trim() !== "";
    });
  };

  const handleAcknowledge = () => {
    setAcknowledged(true);
    if (selectedTask) {
      handleCompleteAndSubmit();
    }
  };

  const handleCompleteAndSubmit = () => {
    if (selectedTask && (selectedTask.status === "pending" || selectedTask.status === "submitted")) {
      const updatedTasks = tasks.map((task) => {
        if (task.id === selectedTask.id) {
          return {
            ...task,
            completed: true,
            status: "for-review" as const,
          };
        }
        return task;
      });
      onUpdateTasks(updatedTasks);
      handleCloseDialog();
    }
  };

  const handleFormSubmit = () => {
    if (isFormComplete() && selectedTask) {
      handleCompleteAndSubmit();
    }
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Task</TableHead>
            <TableHead className="w-[40%]">Description</TableHead>
            <TableHead className="w-[20%]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow 
              key={task.id}
              className="cursor-pointer hover:bg-slate-50"
              onClick={() => handleOpenDialog(task)}
            >
              <TableCell>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {task.completed && <CheckCircle className="size-4 text-green-600" />}
                    <span className="font-medium">{task.title}</span>
                    {task.required && <span className="text-red-600 font-bold">*</span>}
                  </div>
                  {task.feedback && (
                    <p className="text-xs text-red-600">{task.feedback}</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-slate-600">{task.description}</span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <StatusIcon status={task.status} />
                  <StatusBadge status={task.status} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Remarks Section */}
      <RemarksSection items={tasks} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTask?.title}
              {selectedTask?.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
            </DialogTitle>
            <DialogDescription>
              Complete this task to proceed with your onboarding
            </DialogDescription>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Render content based on task type */}
              {selectedTask.contentType === "document" && selectedTask.content && (
                <div className="space-y-4">
                  {selectedTask.content.url && (
                    <div className="w-full bg-slate-100 rounded-lg overflow-hidden h-40">
                      <img src={selectedTask.content.url} alt="Document preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {selectedTask.content.text && (
                    <div className="space-y-2">
                      <ScrollArea
                        className="h-52 w-full border rounded-lg bg-white"
                        onScrollCapture={handleScroll}
                      >
                        <div className="p-4">
                          <pre className="text-sm whitespace-pre-wrap font-sans">{selectedTask.content.text}</pre>
                          {!hasScrolledToBottom && (
                            <p className="text-center text-sm text-slate-400 mt-6 animate-bounce select-none">
                              ↓ Scroll down to continue ↓
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                      {!hasScrolledToBottom && selectedTask.status === "pending" && (
                        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded">
                          <AlertCircle className="size-3" />
                          <span>Please scroll to the bottom of the document to complete this task</span>
                        </div>
                      )}
                      {hasScrolledToBottom && selectedTask.status === "pending" && (
                        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 p-2 rounded">
                          <CheckCircle className="size-3" />
                          <span>Document fully reviewed. Click "Confirm &amp; Submit" below.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {selectedTask.contentType === "video" && selectedTask.content && (
                <div className="space-y-4">
                  {selectedTask.content.url && (
                    <button
                      type="button"
                      className="w-full bg-slate-900 rounded-lg overflow-hidden aspect-video flex items-center justify-center relative cursor-pointer"
                      onClick={handleWatchVideo}
                    >
                      <img src={selectedTask.content.url} alt="Video thumbnail" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <div className="bg-white rounded-full p-4 hover:scale-110 transition-transform">
                          <Video className="size-8 text-slate-900" />
                        </div>
                      </div>
                      {videoWatched && (
                        <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                          <CheckCircle className="size-3" />
                          Watched
                        </div>
                      )}
                    </button>
                  )}
                  {selectedTask.content.text && (
                    <p className="text-sm text-slate-600 text-center">{selectedTask.content.text}</p>
                  )}
                  {!videoWatched && selectedTask.status === "pending" && (
                    <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800 flex items-center gap-2">
                      <AlertCircle className="size-4 shrink-0" />
                      <span>Click the video to simulate watching. You must watch the entire video to proceed.</span>
                    </div>
                  )}
                  {videoWatched && selectedTask.status === "pending" && (
                    <div className="bg-green-50 p-3 rounded-lg text-sm text-green-800 flex items-center gap-2">
                      <CheckCircle className="size-4 shrink-0" />
                      <span>Video completed. Click "Complete & Submit" below.</span>
                    </div>
                  )}
                </div>
              )}

              {selectedTask.contentType === "form" && selectedTask.content?.fields && (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-lg space-y-4">
                    <h4 className="font-medium text-sm">Fill out the form below:</h4>
                    {selectedTask.content.fields.map((field, index) => (
                      <div key={field.label} className="space-y-2">
                        <Label htmlFor={`field-${index}`}>
                          {field.label} {field.required && <span className="text-red-600">*</span>}
                        </Label>
                        {field.type === "select" && field.label === "Account Type" ? (
                          <select 
                            id={`field-${index}`}
                            className="w-full p-2 border rounded-md"
                            required={field.required}
                            onChange={(e) => handleFormChange(field.label, e.target.value)}
                          >
                            <option value="">Select...</option>
                            <option value="checking">Checking</option>
                            <option value="savings">Savings</option>
                          </select>
                        ) : (
                          <Input
                            id={`field-${index}`}
                            type={field.type}
                            placeholder={`Enter ${field.label.toLowerCase()}`}
                            required={field.required}
                            onChange={(e) => handleFormChange(field.label, e.target.value)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedTask.contentType === "acknowledgment" && selectedTask.content && (
                <div className="space-y-4">
                  {selectedTask.content.url && (
                    <div className="w-full bg-slate-100 rounded-lg overflow-hidden h-40">
                      <img src={selectedTask.content.url} alt="Code of Conduct" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {selectedTask.content.text && (
                    <div className="border-2 border-slate-200 rounded-lg p-6 bg-slate-50">
                      <pre className="text-sm whitespace-pre-wrap font-sans">{selectedTask.content.text}</pre>
                    </div>
                  )}
                  <div className="border-2 border-blue-200 bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-900 font-medium mb-3">Acknowledgment Required:</p>
                    <p className="text-sm text-slate-700">
                      By checking the completion box below, you acknowledge that you have read, understood, 
                      and agree to comply with all the terms outlined above.
                    </p>
                  </div>
                </div>
              )}

              {/* Feedback if rejected */}
              {selectedTask.feedback && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-red-600">Feedback</h4>
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{selectedTask.feedback}</p>
                </div>
              )}

              {/* Approved/For Review Status */}
              {selectedTask.status === "approved" && (
                <div className="bg-green-50 p-4 rounded-lg flex items-center gap-3 border-2 border-green-200">
                  <CheckCircle className="size-5 text-green-600 shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-green-800">Task Approved</p>
                    <p className="text-xs text-green-600">This task has been reviewed and approved.</p>
                  </div>
                </div>
              )}

              {selectedTask.status === "for-review" && (
                <div className="bg-orange-50 p-4 rounded-lg flex items-center gap-3 border-2 border-orange-200">
                  <Clock className="size-5 text-orange-600 shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-orange-800">Under Review</p>
                    <p className="text-xs text-orange-600">This task is currently being reviewed by HR.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} size="sm">
              Close
            </Button>
            
            {selectedTask && (selectedTask.status === "pending" || selectedTask.status === "submitted") && (
              <>
                {/* Document: always visible, disabled until scrolled to bottom */}
                {selectedTask.contentType === "document" && (
                  <Button
                    onClick={handleCompleteAndSubmit}
                    size="sm"
                    disabled={!hasScrolledToBottom}
                  >
                    Confirm &amp; Submit
                  </Button>
                )}

                {/* Video: Complete & Submit when video watched */}
                {selectedTask.contentType === "video" && videoWatched && (
                  <Button onClick={handleCompleteAndSubmit} size="sm">
                    Complete & Submit
                  </Button>
                )}

                {/* Form: Submit Form when all required fields filled */}
                {selectedTask.contentType === "form" && (
                  <Button 
                    onClick={handleFormSubmit} 
                    size="sm"
                    disabled={!isFormComplete()}
                  >
                    Submit Form
                  </Button>
                )}

                {/* Acknowledgment: I Acknowledge button */}
                {selectedTask.contentType === "acknowledgment" && !acknowledged && (
                  <Button onClick={handleAcknowledge} size="sm">
                    I Acknowledge & Agree
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}