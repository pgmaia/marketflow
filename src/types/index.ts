export type TaskStatus = 'Not Started' | 'In Progress' | 'Review' | 'Done' | 'Blocked';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TaskType = 'Copy' | 'Design' | 'Video' | 'Ads' | 'SEO' | 'Email' | 'Social' | 'Analytics' | 'Meeting';

// Phase is now a plain string — each project defines its own phases
export type Phase = string;

export interface ProjectPhase {
  id: string;
  name: string;
}

export type UserPermission = 'Admin' | 'Gerente' | 'Membro' | 'Visualizador';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string; // initials or color
  color: string;
  email: string;
  permission?: UserPermission; // undefined = 'Membro' (backwards compat)
}

export type CustomColumnType = 'text' | 'number' | 'select' | 'date';

export interface CustomColumn {
  id: string;
  name: string;
  type: CustomColumnType;
  options?: string[]; // for 'select' type
}

export interface Task {
  id: string;
  projectId: string;
  phase: Phase;
  title: string;
  description?: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  dueDate: string; // ISO date string
  notes?: string;
  createdAt: string;
  parentTaskId?: string; // if set, this is a subtask
  customFields?: Record<string, string>; // colId -> value
}

export interface Project {
  id: string;
  companyId: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  teamMemberIds: string[];
  color: string;
  phases: ProjectPhase[];
  customColumns?: CustomColumn[];
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  color: string;
  logo: string; // initials
}

export interface TemplateTask {
  title: string;
  type: TaskType;
  phase: Phase;
  priority: TaskPriority;
  description?: string;
  notes?: string;
  subtasks?: Array<Omit<TemplateTask, 'subtasks'>>;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description?: string;
  tasks: TemplateTask[];
  createdAt: string;
}

export interface PhaseTemplate {
  id: string;
  name: string;
  description?: string;
  phases: string[]; // list of phase names in order
  createdAt: string;
}

export interface AppFilters {
  companyId: string | null;
  status: TaskStatus | null;
  dueDateRange: 'all' | 'overdue' | 'this-week' | 'this-month';
}

// ── Trash (30-day archive) ────────────────────────────────────────────────────

export type TrashItem =
  | { id: string; deletedAt: string; type: 'company';        data: Company;       projects: Project[]; tasks: Task[] }
  | { id: string; deletedAt: string; type: 'project';        data: Project;       tasks: Task[] }
  | { id: string; deletedAt: string; type: 'task';           data: Task;          subtasks: Task[] }
  | { id: string; deletedAt: string; type: 'flow';           data: FlowBoard }
  | { id: string; deletedAt: string; type: 'flowNode';       data: FlowNode;      flowId: string }
  | { id: string; deletedAt: string; type: 'taskTemplate';   data: TaskTemplate }
  | { id: string; deletedAt: string; type: 'phaseTemplate';  data: PhaseTemplate }
  | { id: string; deletedAt: string; type: 'phase';          data: ProjectPhase;  projectId: string }
  | { id: string; deletedAt: string; type: 'customColumn';   data: CustomColumn;  projectId: string };

// ── Flow Builder ──

export type FlowNodeType = 'stage' | 'action' | 'note' | 'decision';

export interface FlowNodeTask {
  id: string;
  title: string;
  type?: TaskType;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  x: number;
  y: number;
  width: number;
  title: string;
  description?: string;
  color: string;
  tasks: FlowNodeTask[];
}

export interface FlowEdge {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
}

export interface FlowBoard {
  id: string;
  name: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  createdAt: string;
}
