"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Settings,
  FileCheck,
  ListChecks,
  Package,
  Plus,
  Eye,
  Search,
  Building,
  Users,
  ClipboardList,
  LayoutTemplate,
  Save,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import type { OnboardingTemplate } from "@/types/onboarding.types";
import { getAllTemplates, createTemplate } from "@/lib/onboardingApi";

interface Department {
  id: string;
  name: string;
  employeeCount: number;
}

interface Position {
  id: string;
  title: string;
  department: string;
}

const initialDepartments: Department[] = [
  { id: "dept-1", name: "Engineering", employeeCount: 45 },
  { id: "dept-2", name: "Product", employeeCount: 12 },
  { id: "dept-3", name: "Design", employeeCount: 8 },
  { id: "dept-4", name: "Marketing", employeeCount: 15 },
  { id: "dept-5", name: "Analytics", employeeCount: 6 },
];

const initialPositions: Position[] = [
  { id: "pos-1", title: "Software Engineer", department: "Engineering" },
  { id: "pos-2", title: "Senior Software Engineer", department: "Engineering" },
  { id: "pos-3", title: "Product Manager", department: "Product" },
  { id: "pos-4", title: "UX Designer", department: "Design" },
  { id: "pos-5", title: "Marketing Specialist", department: "Marketing" },
  { id: "pos-6", title: "Data Analyst", department: "Analytics" },
];

export default function SystemAdminView() {
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [positions, setPositions] = useState<Position[]>(initialPositions);
  const [selectedTemplate, setSelectedTemplate] = useState<OnboardingTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // New template states
  const [showNewTemplateDialog, setShowNewTemplateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDepartment, setNewTemplateDepartment] = useState("");
  const [newTemplatePosition, setNewTemplatePosition] = useState("");
  const [newTemplateDeadline, setNewTemplateDeadline] = useState("7");
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  // New department/position states
  const [showNewDepartmentDialog, setShowNewDepartmentDialog] = useState(false);
  const [showNewPositionDialog, setShowNewPositionDialog] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newPositionTitle, setNewPositionTitle] = useState("");
  const [newPositionDepartment, setNewPositionDepartment] = useState("");

  useEffect(() => {
    getAllTemplates().then(setTemplates).catch(console.error);
  }, []);

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim() || !newTemplateDepartment || !newTemplatePosition) return;

    setCreatingTemplate(true);
    try {
      await createTemplate({
        name: newTemplateName.trim(),
        department_id: newTemplateDepartment,
        position_id: newTemplatePosition,
        default_deadline_days: Number.parseInt(newTemplateDeadline),
        items: [],
      });
      const updated = await getAllTemplates();
      setTemplates(updated);
      setNewTemplateName("");
      setNewTemplateDepartment("");
      setNewTemplatePosition("");
      setNewTemplateDeadline("7");
      setShowNewTemplateDialog(false);
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingTemplate(false);
    }
  };

  const handleCreateDepartment = () => {
    if (!newDepartmentName.trim()) return;
    setDepartments([...departments, { id: `dept-${Date.now()}`, name: newDepartmentName, employeeCount: 0 }]);
    setNewDepartmentName("");
    setShowNewDepartmentDialog(false);
  };

  const handleCreatePosition = () => {
    if (!newPositionTitle.trim() || !newPositionDepartment) return;
    const dept = departments.find(d => d.id === newPositionDepartment);
    setPositions([...positions, { id: `pos-${Date.now()}`, title: newPositionTitle, department: dept?.name ?? newPositionDepartment }]);
    setNewPositionTitle("");
    setNewPositionDepartment("");
    setShowNewPositionDialog(false);
  };

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.department_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.position_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Settings className="size-8" />
              System Administration
            </h1>
            <p className="text-slate-600">Manage onboarding templates, departments, and system settings</p>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Templates</CardTitle>
              <LayoutTemplate className="size-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{templates.length}</div>
              <p className="text-xs text-slate-500">Onboarding templates</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Departments</CardTitle>
              <Building className="size-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{departments.length}</div>
              <p className="text-xs text-slate-500">Active departments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Positions</CardTitle>
              <ClipboardList className="size-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{positions.length}</div>
              <p className="text-xs text-slate-500">Position types</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="size-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {departments.reduce((sum, dept) => sum + dept.employeeCount, 0)}
              </div>
              <p className="text-xs text-slate-500">Across all departments</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>System Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="templates">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="templates">
                  <LayoutTemplate className="size-4 mr-2" />
                  Onboarding Templates
                </TabsTrigger>
                <TabsTrigger value="departments">
                  <Building className="size-4 mr-2" />
                  Departments
                </TabsTrigger>
                <TabsTrigger value="positions">
                  <ClipboardList className="size-4 mr-2" />
                  Positions
                </TabsTrigger>
              </TabsList>

              {/* Templates Tab */}
              <TabsContent value="templates" className="space-y-4 mt-4">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                    <Input
                      placeholder="Search templates..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button onClick={() => setShowNewTemplateDialog(true)}>
                    <Plus className="size-4 mr-2" />
                    New Template
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Documents</TableHead>
                      <TableHead>Tasks</TableHead>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTemplates.map((template) => (
                      <TableRow key={template.template_id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell>{template.department_id}</TableCell>
                        <TableCell>{template.position_id}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {template.template_items.filter(i => i.tab_category === "documents").length}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {template.template_items.filter(i => i.tab_category === "tasks").length}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {template.template_items.filter(i => i.tab_category === "equipment").length}
                          </Badge>
                        </TableCell>
                        <TableCell>{template.default_deadline_days} days</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTemplate(template)}
                          >
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredTemplates.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                          No templates found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* Departments Tab */}
              <TabsContent value="departments" className="space-y-4 mt-4">
                <div className="flex justify-end">
                  <Button onClick={() => setShowNewDepartmentDialog(true)}>
                    <Plus className="size-4 mr-2" />
                    Add Department
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Department Name</TableHead>
                      <TableHead>Employee Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departments.map((dept) => (
                      <TableRow key={dept.id}>
                        <TableCell className="font-medium">{dept.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{dept.employeeCount} employees</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* Positions Tab */}
              <TabsContent value="positions" className="space-y-4 mt-4">
                <div className="flex justify-end">
                  <Button onClick={() => setShowNewPositionDialog(true)}>
                    <Plus className="size-4 mr-2" />
                    Add Position
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Position Title</TableHead>
                      <TableHead>Department</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.map((pos) => (
                      <TableRow key={pos.id}>
                        <TableCell className="font-medium">{pos.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{pos.department}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* View Template Dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>Template: {selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              View documents, tasks, and equipment for this onboarding template
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <Tabs defaultValue="documents">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="documents">
                    <FileCheck className="size-4 mr-2" />
                    Documents ({selectedTemplate.template_items.filter(i => i.tab_category === "documents").length})
                  </TabsTrigger>
                  <TabsTrigger value="tasks">
                    <ListChecks className="size-4 mr-2" />
                    Tasks ({selectedTemplate.template_items.filter(i => i.tab_category === "tasks").length})
                  </TabsTrigger>
                  <TabsTrigger value="equipment">
                    <Package className="size-4 mr-2" />
                    Equipment ({selectedTemplate.template_items.filter(i => i.tab_category === "equipment").length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="documents" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document Name</TableHead>
                        <TableHead>Required</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTemplate.template_items.filter(i => i.tab_category === "documents").map((item) => (
                        <TableRow key={item.item_id}>
                          <TableCell className="font-medium">{item.title}</TableCell>
                          <TableCell>
                            <Badge variant={item.is_required ? "default" : "secondary"}>
                              {item.is_required ? "Required" : "Optional"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {selectedTemplate.template_items.filter(i => i.tab_category === "documents").length === 0 && (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center py-4 text-slate-500">No documents</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="tasks" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Required</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTemplate.template_items.filter(i => i.tab_category === "tasks").map((item) => (
                        <TableRow key={item.item_id}>
                          <TableCell className="font-medium">{item.title}</TableCell>
                          <TableCell className="text-sm text-slate-600">{item.description ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant={item.is_required ? "default" : "secondary"}>
                              {item.is_required ? "Required" : "Optional"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {selectedTemplate.template_items.filter(i => i.tab_category === "tasks").length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-4 text-slate-500">No tasks</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="equipment" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipment Name</TableHead>
                        <TableHead>Required</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTemplate.template_items.filter(i => i.tab_category === "equipment").map((item) => (
                        <TableRow key={item.item_id}>
                          <TableCell className="font-medium">{item.title}</TableCell>
                          <TableCell>
                            <Badge variant={item.is_required ? "default" : "secondary"}>
                              {item.is_required ? "Required" : "Optional"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {selectedTemplate.template_items.filter(i => i.tab_category === "equipment").length === 0 && (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center py-4 text-slate-500">No equipment</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            </div>
          )}

          <div className="px-6 py-4 border-t flex justify-end">
            <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Template Dialog */}
      <Dialog open={showNewTemplateDialog} onOpenChange={setShowNewTemplateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Onboarding Template</DialogTitle>
            <DialogDescription>
              Set up a new template for employee onboarding
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                placeholder="e.g., Senior Developer Onboarding"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={newTemplateDepartment} onValueChange={setNewTemplateDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Select value={newTemplatePosition} onValueChange={setNewTemplatePosition}>
                <SelectTrigger>
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  {positions
                    .filter(p => !newTemplateDepartment || departments.find(d => d.id === newTemplateDepartment)?.name === p.department)
                    .map((pos) => (
                      <SelectItem key={pos.id} value={pos.id}>
                        {pos.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Deadline (days)</Label>
              <Input
                type="number"
                placeholder="7"
                value={newTemplateDeadline}
                onChange={(e) => setNewTemplateDeadline(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNewTemplateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTemplate} disabled={creatingTemplate}>
              <Save className="size-4 mr-2" />
              {creatingTemplate ? "Creating..." : "Create Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Department Dialog */}
      <Dialog open={showNewDepartmentDialog} onOpenChange={setShowNewDepartmentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Department</DialogTitle>
            <DialogDescription>
              Create a new department in the system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Department Name</Label>
              <Input
                placeholder="e.g., Human Resources"
                value={newDepartmentName}
                onChange={(e) => setNewDepartmentName(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNewDepartmentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDepartment}>
              <Plus className="size-4 mr-2" />
              Add Department
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Position Dialog */}
      <Dialog open={showNewPositionDialog} onOpenChange={setShowNewPositionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Position</DialogTitle>
            <DialogDescription>
              Create a new position type in the system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Position Title</Label>
              <Input
                placeholder="e.g., Lead Developer"
                value={newPositionTitle}
                onChange={(e) => setNewPositionTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={newPositionDepartment} onValueChange={setNewPositionDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNewPositionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePosition}>
              <Plus className="size-4 mr-2" />
              Add Position
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
