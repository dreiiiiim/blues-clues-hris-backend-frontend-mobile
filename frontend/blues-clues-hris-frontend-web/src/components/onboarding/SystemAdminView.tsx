import { useState } from "react";
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
  Trash2, 
  Edit, 
  Search,
  Building,
  Users,
  ClipboardList,
  LayoutTemplate,
  Save,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

interface TemplateDocument {
  id: string;
  name: string;
  required: boolean;
  description?: string;
}

interface TemplateTask {
  id: string;
  name: string;
  description: string;
  required: boolean;
}

interface TemplateEquipment {
  id: string;
  name: string;
  category: string;
  description?: string;
}

interface AdminTemplate {
  id: string;
  name: string;
  department: string;
  position: string;
  documents: TemplateDocument[];
  tasks: TemplateTask[];
  equipment: TemplateEquipment[];
  deadlineDays: number;
}

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

// Shared base documents reused across templates
const BASE_DOCUMENTS: TemplateDocument[] = [
  { id: "doc-1", name: "Birth Certificate (PSA)", required: true },
  { id: "doc-2", name: "NBI Clearance", required: true },
  { id: "doc-3", name: "SSS E-1 Form", required: true },
  { id: "doc-4", name: "PhilHealth MDR", required: true },
  { id: "doc-5", name: "Pag-IBIG MDF", required: true },
];

// Mock data
const initialTemplates: AdminTemplate[] = [
  {
    id: "template-1",
    name: "Software Engineer Onboarding",
    department: "Engineering",
    position: "Software Engineer",
    deadlineDays: 7,
    documents: [
      ...BASE_DOCUMENTS,
      { id: "doc-6", name: "BIR Form 2316", required: false },
    ],
    tasks: [
      { id: "task-1", name: "Complete Company Orientation", description: "Watch orientation video and complete quiz", required: true },
      { id: "task-2", name: "IT Security Training", description: "Complete cybersecurity awareness module", required: true },
      { id: "task-3", name: "Set Up Email Signature", description: "Configure official email signature", required: true },
      { id: "task-4", name: "Review Employee Handbook", description: "Read and acknowledge employee handbook", required: true },
      { id: "task-5", name: "Development Environment Setup", description: "Install required development tools", required: true },
    ],
    equipment: [
      { id: "equip-1", name: "MacBook Pro M3", category: "Laptop" },
      { id: "equip-2", name: "External Monitor (27\")", category: "Monitor" },
      { id: "equip-3", name: "Mechanical Keyboard", category: "Accessories" },
      { id: "equip-4", name: "Wireless Mouse", category: "Accessories" },
    ],
  },
  {
    id: "template-2",
    name: "Product Manager Onboarding",
    department: "Product",
    position: "Product Manager",
    deadlineDays: 7,
    documents: [...BASE_DOCUMENTS],
    tasks: [
      { id: "task-1", name: "Complete Company Orientation", description: "Watch orientation video and complete quiz", required: true },
      { id: "task-2", name: "Product Tools Training", description: "Learn product management tools", required: true },
      { id: "task-3", name: "Meet Engineering Team", description: "Introduction meeting with engineering", required: true },
      { id: "task-4", name: "Review Product Roadmap", description: "Understand current product strategy", required: true },
    ],
    equipment: [
      { id: "equip-1", name: "MacBook Air M2", category: "Laptop" },
      { id: "equip-2", name: "iPad Pro", category: "Tablet" },
      { id: "equip-3", name: "Wireless Mouse", category: "Accessories" },
    ],
  },
];

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
  const [templates, setTemplates] = useState<AdminTemplate[]>(initialTemplates);
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [positions, setPositions] = useState<Position[]>(initialPositions);
  const [selectedTemplate, setSelectedTemplate] = useState<AdminTemplate | null>(null);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // New template states
  const [showNewTemplateDialog, setShowNewTemplateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDepartment, setNewTemplateDepartment] = useState("");
  const [newTemplatePosition, setNewTemplatePosition] = useState("");
  const [newTemplateDeadline, setNewTemplateDeadline] = useState("7");

  // New department/position states
  const [showNewDepartmentDialog, setShowNewDepartmentDialog] = useState(false);
  const [showNewPositionDialog, setShowNewPositionDialog] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newPositionTitle, setNewPositionTitle] = useState("");
  const [newPositionDepartment, setNewPositionDepartment] = useState("");

  // Template item states
  const [newDocumentName, setNewDocumentName] = useState("");
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newEquipmentName, setNewEquipmentName] = useState("");
  const [newEquipmentCategory, setNewEquipmentCategory] = useState("");

  const handleCreateTemplate = () => {
    if (!newTemplateName.trim() || !newTemplateDepartment || !newTemplatePosition) return;

    const newTemplate: AdminTemplate = {
      id: `template-${Date.now()}`,
      name: newTemplateName,
      department: newTemplateDepartment,
      position: newTemplatePosition,
      deadlineDays: Number.parseInt(newTemplateDeadline),
      documents: [],
      tasks: [],
      equipment: [],
    };

    setTemplates([...templates, newTemplate]);
    setNewTemplateName("");
    setNewTemplateDepartment("");
    setNewTemplatePosition("");
    setNewTemplateDeadline("7");
    setShowNewTemplateDialog(false);
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (confirm("Are you sure you want to delete this template?")) {
      setTemplates(templates.filter(t => t.id !== templateId));
      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null);
      }
    }
  };

  const handleAddDocumentToTemplate = () => {
    if (!selectedTemplate || !newDocumentName.trim()) return;

    const updatedTemplate = {
      ...selectedTemplate,
      documents: [
        ...selectedTemplate.documents,
        {
          id: `doc-${Date.now()}`,
          name: newDocumentName,
          required: true,
        },
      ],
    };

    setTemplates(templates.map(t => t.id === selectedTemplate.id ? updatedTemplate : t));
    setSelectedTemplate(updatedTemplate);
    setNewDocumentName("");
  };

  const handleAddTaskToTemplate = () => {
    if (!selectedTemplate || !newTaskName.trim() || !newTaskDescription.trim()) return;

    const updatedTemplate = {
      ...selectedTemplate,
      tasks: [
        ...selectedTemplate.tasks,
        {
          id: `task-${Date.now()}`,
          name: newTaskName,
          description: newTaskDescription,
          required: true,
        },
      ],
    };

    setTemplates(templates.map(t => t.id === selectedTemplate.id ? updatedTemplate : t));
    setSelectedTemplate(updatedTemplate);
    setNewTaskName("");
    setNewTaskDescription("");
  };

  const handleAddEquipmentToTemplate = () => {
    if (!selectedTemplate || !newEquipmentName.trim() || !newEquipmentCategory.trim()) return;

    const updatedTemplate = {
      ...selectedTemplate,
      equipment: [
        ...selectedTemplate.equipment,
        {
          id: `equip-${Date.now()}`,
          name: newEquipmentName,
          category: newEquipmentCategory,
        },
      ],
    };

    setTemplates(templates.map(t => t.id === selectedTemplate.id ? updatedTemplate : t));
    setSelectedTemplate(updatedTemplate);
    setNewEquipmentName("");
    setNewEquipmentCategory("");
  };

  const handleRemoveDocumentFromTemplate = (docId: string) => {
    if (!selectedTemplate) return;

    const updatedTemplate = {
      ...selectedTemplate,
      documents: selectedTemplate.documents.filter(d => d.id !== docId),
    };

    setTemplates(templates.map(t => t.id === selectedTemplate.id ? updatedTemplate : t));
    setSelectedTemplate(updatedTemplate);
  };

  const handleRemoveTaskFromTemplate = (taskId: string) => {
    if (!selectedTemplate) return;

    const updatedTemplate = {
      ...selectedTemplate,
      tasks: selectedTemplate.tasks.filter(t => t.id !== taskId),
    };

    setTemplates(templates.map(t => t.id === selectedTemplate.id ? updatedTemplate : t));
    setSelectedTemplate(updatedTemplate);
  };

  const handleRemoveEquipmentFromTemplate = (equipId: string) => {
    if (!selectedTemplate) return;

    const updatedTemplate = {
      ...selectedTemplate,
      equipment: selectedTemplate.equipment.filter(e => e.id !== equipId),
    };

    setTemplates(templates.map(t => t.id === selectedTemplate.id ? updatedTemplate : t));
    setSelectedTemplate(updatedTemplate);
  };

  const handleCreateDepartment = () => {
    if (!newDepartmentName.trim()) return;

    const newDept: Department = {
      id: `dept-${Date.now()}`,
      name: newDepartmentName,
      employeeCount: 0,
    };

    setDepartments([...departments, newDept]);
    setNewDepartmentName("");
    setShowNewDepartmentDialog(false);
  };

  const handleCreatePosition = () => {
    if (!newPositionTitle.trim() || !newPositionDepartment) return;

    const newPos: Position = {
      id: `pos-${Date.now()}`,
      title: newPositionTitle,
      department: newPositionDepartment,
    };

    setPositions([...positions, newPos]);
    setNewPositionTitle("");
    setNewPositionDepartment("");
    setShowNewPositionDialog(false);
  };

  const handleDeleteDepartment = (deptId: string) => {
    if (confirm("Are you sure you want to delete this department?")) {
      setDepartments(departments.filter(d => d.id !== deptId));
    }
  };

  const handleDeletePosition = (posId: string) => {
    if (confirm("Are you sure you want to delete this position?")) {
      setPositions(positions.filter(p => p.id !== posId));
    }
  };

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.position.toLowerCase().includes(searchQuery.toLowerCase())
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
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell>{template.department}</TableCell>
                        <TableCell>{template.position}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{template.documents.length}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{template.tasks.length}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{template.equipment.length}</Badge>
                        </TableCell>
                        <TableCell>{template.deadlineDays} days</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedTemplate(template);
                                setIsEditingTemplate(true);
                              }}
                            >
                              <Edit className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTemplate(template.id)}
                            >
                              <Trash2 className="size-4 text-red-600" />
                            </Button>
                          </div>
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
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departments.map((dept) => (
                      <TableRow key={dept.id}>
                        <TableCell className="font-medium">{dept.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{dept.employeeCount} employees</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteDepartment(dept.id)}
                          >
                            <Trash2 className="size-4 text-red-600" />
                          </Button>
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
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.map((pos) => (
                      <TableRow key={pos.id}>
                        <TableCell className="font-medium">{pos.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{pos.department}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePosition(pos.id)}
                          >
                            <Trash2 className="size-4 text-red-600" />
                          </Button>
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
                    <SelectItem key={dept.id} value={dept.name}>
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
                    .filter(p => !newTemplateDepartment || p.department === newTemplateDepartment)
                    .map((pos) => (
                      <SelectItem key={pos.id} value={pos.title}>
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
            <Button onClick={handleCreateTemplate}>
              <Save className="size-4 mr-2" />
              Create Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={isEditingTemplate} onOpenChange={setIsEditingTemplate}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>Edit Template: {selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              Configure documents, tasks, and equipment for this onboarding template
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <Tabs defaultValue="documents">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="documents">
                    <FileCheck className="size-4 mr-2" />
                    Documents ({selectedTemplate.documents.length})
                  </TabsTrigger>
                  <TabsTrigger value="tasks">
                    <ListChecks className="size-4 mr-2" />
                    Tasks ({selectedTemplate.tasks.length})
                  </TabsTrigger>
                  <TabsTrigger value="equipment">
                    <Package className="size-4 mr-2" />
                    Equipment ({selectedTemplate.equipment.length})
                  </TabsTrigger>
                </TabsList>

                {/* Documents */}
                <TabsContent value="documents" className="space-y-4 mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document Name</TableHead>
                        <TableHead>Required</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTemplate.documents.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium">{doc.name}</TableCell>
                          <TableCell>
                            <Badge variant={doc.required ? "default" : "secondary"}>
                              {doc.required ? "Required" : "Optional"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveDocumentFromTemplate(doc.id)}
                            >
                              <Trash2 className="size-4 text-red-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        <Label>Add New Document</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Document name..."
                            value={newDocumentName}
                            onChange={(e) => setNewDocumentName(e.target.value)}
                            className="bg-white"
                          />
                          <Button onClick={handleAddDocumentToTemplate}>
                            <Plus className="size-4 mr-2" />
                            Add
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tasks */}
                <TabsContent value="tasks" className="space-y-4 mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Required</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTemplate.tasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell className="font-medium">{task.name}</TableCell>
                          <TableCell className="text-sm text-slate-600">{task.description}</TableCell>
                          <TableCell>
                            <Badge variant={task.required ? "default" : "secondary"}>
                              {task.required ? "Required" : "Optional"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveTaskFromTemplate(task.id)}
                            >
                              <Trash2 className="size-4 text-red-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        <Label>Add New Task</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Task name..."
                            value={newTaskName}
                            onChange={(e) => setNewTaskName(e.target.value)}
                            className="bg-white"
                          />
                          <Input
                            placeholder="Description..."
                            value={newTaskDescription}
                            onChange={(e) => setNewTaskDescription(e.target.value)}
                            className="bg-white"
                          />
                          <Button onClick={handleAddTaskToTemplate}>
                            <Plus className="size-4 mr-2" />
                            Add
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Equipment */}
                <TabsContent value="equipment" className="space-y-4 mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipment Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTemplate.equipment.map((equip) => (
                        <TableRow key={equip.id}>
                          <TableCell className="font-medium">{equip.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{equip.category}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveEquipmentFromTemplate(equip.id)}
                            >
                              <Trash2 className="size-4 text-red-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Card className="bg-purple-50 border-purple-200">
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        <Label>Add New Equipment</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Equipment name..."
                            value={newEquipmentName}
                            onChange={(e) => setNewEquipmentName(e.target.value)}
                            className="bg-white"
                          />
                          <Input
                            placeholder="Category..."
                            value={newEquipmentCategory}
                            onChange={(e) => setNewEquipmentCategory(e.target.value)}
                            className="bg-white"
                          />
                          <Button onClick={handleAddEquipmentToTemplate}>
                            <Plus className="size-4 mr-2" />
                            Add
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}

          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditingTemplate(false)}>
              Close
            </Button>
            <Button onClick={() => setIsEditingTemplate(false)}>
              <Save className="size-4 mr-2" />
              Save Changes
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
                    <SelectItem key={dept.id} value={dept.name}>
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
