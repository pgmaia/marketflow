import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Company, CustomColumn, Project, ProjectPhase, PhaseTemplate, Task, TaskTemplate, Team, TeamMember, AppFilters, TaskStatus, RecurrenceType, FlowBoard, FlowNode, FlowEdge, FlowNodeTask, UserPermission, TrashItem, PersonalTask, TaskTypeConfig, DocEntry, DocSection, FlowLane, FlowNodeSubtask } from '../types';

// ─── Recurrence helper ────────────────────────────────────────────────────────

export function calcNextDueDate(from: string, type: RecurrenceType, daysAfter = 7): string {
  if (type === 'days_after') {
    const d = new Date();
    d.setDate(d.getDate() + daysAfter);
    return localISO(d);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(from + 'T00:00:00');
  const dayOfMonth = d.getDate();
  let guard = 0;
  // Keep stepping until the next occurrence is actually in the future. A task
  // left overdue for weeks used to yield another past-due date, so completing
  // it once never brought the series up to date - the user had to tick it off
  // again and again to walk the date forward to today.
  do {
    if (type === 'daily')  d.setDate(d.getDate() + 1);
    if (type === 'weekly') d.setDate(d.getDate() + 7);
    if (type === 'monthly') {
      // setMonth() on the 31st overflows into the month after next (Jan 31 ->
      // Mar 3), skipping February entirely and drifting the series to day 3.
      // Pin to the 1st, step the month, then clamp to that month's last day.
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      d.setDate(Math.min(dayOfMonth, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    }
    if (type === 'yearly') d.setFullYear(d.getFullYear() + 1);
  } while (d <= today && ++guard < 4000);
  return localISO(d);
}
import { seedCompanies, seedProjects, seedTasks, seedTeamMembers, DEFAULT_PHASES, MEMBER_PASSWORDS } from '../data/seed';
import { localISO } from '../lib/date';

// IDs that belong to seed data — used to distinguish user-created records
const SEED_COMPANY_IDS = new Set(seedCompanies.map(c => c.id));
const SEED_MEMBER_IDS  = new Set(seedTeamMembers.map(m => m.id));

type AppView = 'dashboard' | 'company' | 'project' | 'users' | 'flow' | 'trash' | 'schedule' | 'backup';

interface AppState {
  companies: Company[];
  projects: Project[];
  tasks: Task[];
  personalTasks: PersonalTask[];
  teamMembers: TeamMember[];
  templates: TaskTemplate[];
  phaseTemplates: PhaseTemplate[];
  filters: AppFilters;
  flows: FlowBoard[];
  activeFlowId: string | null;
  trash: TrashItem[];
  currentUserId: string | null;
  isAuthenticated: boolean;
  darkMode: boolean;
  memberPasswords: Record<string, string>;
  deletedMemberIds: string[];
  taskTypes: TaskTypeConfig[];
  docEntries: DocEntry[];

  teams: Team[];

  // Navigation
  activeCompanyId: string | null;
  activeProjectId: string | null;
  activeTaskId: string | null;
  view: AppView;
  memberAccess: Record<string, string[]>;
  memberCompanyAccess: Record<string, string[]>;

  // Actions
  setActiveCompany: (id: string | null) => void;
  setActiveProject: (id: string | null) => void;
  setActiveTask: (id: string | null) => void;
  setView: (view: AppView) => void;
  setCurrentUser: (id: string | null) => void;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  toggleDarkMode: () => void;
  addTeamMember: (data: Omit<TeamMember, 'id'>, password: string) => void;
  updateTeamMember: (id: string, data: Partial<Omit<TeamMember, 'id'>>, newPassword?: string) => void;
  deleteTeamMember: (id: string) => void;

  // Teams
  addTeam: (name: string, color: string, companyId?: string) => void;
  updateTeam: (id: string, data: Partial<Pick<Team, 'name' | 'color' | 'companyId'>>) => void;
  deleteTeam: (id: string) => void;
  addPersonToTeam: (teamId: string, memberId: string) => void;
  removePersonFromTeam: (teamId: string, memberId: string) => void;
  setMemberProjectAccess: (memberId: string, projectId: string, hasAccess: boolean) => void;
  setMemberAllAccess: (memberId: string, hasAccess: boolean) => void;
  setMemberCompanyAccess: (memberId: string, companyId: string, hasAccess: boolean) => void;
  setMemberAllCompanyAccess: (memberId: string, hasAccess: boolean) => void;
  setFilters: (filters: Partial<AppFilters>) => void;

  // Personal Tasks
  addPersonalTask: (task: Omit<PersonalTask, 'id' | 'createdAt'>) => void;
  updatePersonalTask: (id: string, updates: Partial<PersonalTask>) => void;
  deletePersonalTask: (id: string) => void;

  // Flow actions
  setActiveFlow: (id: string | null) => void;
  addFlow: (flow: FlowBoard) => void;
  updateFlow: (id: string, patch: Partial<FlowBoard>) => void;
  deleteFlow: (id: string) => void;
  updateFlowNode: (flowId: string, nodeId: string, patch: Partial<FlowNode>) => void;
  addFlowNode: (flowId: string, node: FlowNode) => void;
  deleteFlowNode: (flowId: string, nodeId: string) => void;
  addFlowEdge: (flowId: string, edge: FlowEdge) => void;
  addFlowLane: (flowId: string, lane: FlowLane) => void;
  updateFlowLane: (flowId: string, laneId: string, patch: Partial<FlowLane>) => void;
  deleteFlowLane: (flowId: string, laneId: string) => void;
  deleteFlowEdge: (flowId: string, edgeId: string) => void;
  addFlowNodeTask: (flowId: string, nodeId: string, task: FlowNodeTask) => void;
  deleteFlowNodeTask: (flowId: string, nodeId: string, taskId: string) => void;
  addFlowNodeSubtask: (flowId: string, nodeId: string, taskId: string, subtask: FlowNodeSubtask) => void;
  deleteFlowNodeSubtask: (flowId: string, nodeId: string, taskId: string, subtaskId: string) => void;

  // Company CRUD
  addCompany: (company: Company) => void;
  deleteCompany: (id: string) => void;

  // Member permissions
  updateMemberPermission: (memberId: string, permission: UserPermission) => void;

  // Project CRUD
  addProject: (project: Project) => void;
  updateProject: (id: string, patch: Partial<Pick<Project, 'name' | 'description' | 'color' | 'startDate' | 'endDate' | 'document'>>) => void;
  deleteProject: (id: string) => void;

  // Task CRUD
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (taskId: string, newPhase: string, newStatus: TaskStatus) => void;

  // Task Template CRUD
  addTemplate: (template: TaskTemplate) => void;
  deleteTemplate: (id: string) => void;
  applyTemplate: (templateId: string, projectId: string) => void;

  // Phase CRUD (per project)
  addPhase: (projectId: string, name: string) => void;
  renamePhase: (projectId: string, phaseId: string, newName: string) => void;
  deletePhase: (projectId: string, phaseId: string) => void;
  reorderPhases: (projectId: string, phases: ProjectPhase[]) => void;

  // Phase Templates
  addPhaseTemplate: (template: PhaseTemplate) => void;
  deletePhaseTemplate: (id: string) => void;
  applyPhaseTemplate: (templateId: string, projectId: string) => void;

  // Custom Columns
  addCustomColumn: (projectId: string, col: Omit<CustomColumn, 'id'>) => void;
  removeCustomColumn: (projectId: string, colId: string) => void;
  renameCustomColumn: (projectId: string, colId: string, name: string) => void;

  // Trash
  restoreFromTrash: (trashId: string) => void;
  permanentlyDeleteFromTrash: (trashId: string) => void;
  clearTrash: () => void;
  purgeExpiredTrash: () => void;

  // Project documentation (append-only log)
  addDocEntry: (projectId: string, section: DocSection, text: string) => void;
  deleteDocEntry: (id: string) => void;

  // Flow ↔ project linkage
  createFlowFromProject: (projectId: string) => void;

  // Task Types CRUD
  addTaskType: (type: TaskTypeConfig) => void;
  updateTaskType: (value: string, patch: Partial<TaskTypeConfig>) => void;
  deleteTaskType: (value: string) => void;
  reorderTaskTypes: (types: TaskTypeConfig[]) => void;
}

// ── Flow ↔ project linkage helpers ───────────────────────────────────────────
// On a linked board, a node's tasks belong to the phase of the lane the node
// sits in (nearest lane when outside all of them); with no lanes, the node's
// own title is the phase — the same rule "Salvar como projeto" uses.
function phaseForNode(board: FlowBoard, node: FlowNode): string {
  const lanes = [...(board.lanes ?? [])].sort((a, b) => a.x - b.x);
  if (lanes.length === 0) return node.title;
  const cx = node.x + node.width / 2;
  const inside = lanes.find(l => cx >= l.x && cx <= l.x + l.width);
  if (inside) return inside.title;
  let best = lanes[0], bestD = Infinity;
  for (const l of lanes) {
    const d = Math.abs(cx - (l.x + l.width / 2));
    if (d < bestD) { bestD = d; best = l; }
  }
  return best.title;
}

const trashId = () => `trash-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const now = () => new Date().toISOString();
const isExpired = (deletedAt: string) =>
  Date.now() - new Date(deletedAt).getTime() > 30 * 24 * 60 * 60 * 1000;

const defaultFilters: AppFilters = {
  companyId: null,
  status: null,
  dueDateRange: 'all',
};

const DEFAULT_TASK_TYPES: TaskTypeConfig[] = [
  { value: 'Copy',      label: 'Copy',      emoji: '✍️',  color: 'bg-purple-50 text-purple-700' },
  { value: 'Design',    label: 'Design',    emoji: '🎨',  color: 'bg-pink-50 text-pink-700'     },
  { value: 'Trafego',   label: 'Tráfego',   emoji: '📣',  color: 'bg-orange-50 text-orange-700' },
  { value: 'Email',     label: 'E-mail',    emoji: '📧',  color: 'bg-blue-50 text-blue-700'     },
  { value: 'Campanha',  label: 'Campanha',  emoji: '🚀',  color: 'bg-red-50 text-red-700'       },
  { value: 'Conteudo',  label: 'Conteúdo',  emoji: '📱',  color: 'bg-cyan-50 text-cyan-700'     },
  { value: 'Analytics', label: 'Analytics', emoji: '📊',  color: 'bg-indigo-50 text-indigo-700' },
  { value: 'Meeting',   label: 'Reunião',   emoji: '🗓️', color: 'bg-gray-100 text-gray-700'    },
  { value: 'Comercial', label: 'Comercial', emoji: '💼',  color: 'bg-green-50 text-green-700'   },
];

const seedFlow: FlowBoard = {
  id: 'flow-1',
  name: 'Funil de Vendas Padrão',
  description: 'Fluxo completo de funil de marketing e vendas',
  createdAt: localISO(),
  edges: [
    { id: 'e1', fromId: 'fn1', toId: 'fn2' },
    { id: 'e2', fromId: 'fn2', toId: 'fn3' },
    { id: 'e3', fromId: 'fn3', toId: 'fn4' },
    { id: 'e4', fromId: 'fn4', toId: 'fn5' },
  ],
  nodes: [
    {
      id: 'fn1', type: 'stage', x: 60, y: 80, width: 220, color: '#6366f1',
      title: 'Atração',
      description: 'Gerar tráfego qualificado',
      tasks: [
        { id: 'fnt1', title: 'Criar posts de redes sociais', type: 'Social' },
        { id: 'fnt2', title: 'Campanha de anúncios Meta Ads', type: 'Ads' },
        { id: 'fnt3', title: 'Conteúdo SEO para blog', type: 'SEO' },
      ],
    },
    {
      id: 'fn2', type: 'stage', x: 340, y: 80, width: 220, color: '#8b5cf6',
      title: 'Captura',
      description: 'Converter visitantes em leads',
      tasks: [
        { id: 'fnt4', title: 'Landing page de captura', type: 'Design' },
        { id: 'fnt5', title: 'Email de boas-vindas', type: 'Email' },
        { id: 'fnt6', title: 'Lead magnet (e-book/checklist)', type: 'Copy' },
      ],
    },
    {
      id: 'fn3', type: 'stage', x: 620, y: 80, width: 220, color: '#f59e0b',
      title: 'Nutrição',
      description: 'Educar e engajar os leads',
      tasks: [
        { id: 'fnt7', title: 'Sequência de emails (7 dias)', type: 'Email' },
        { id: 'fnt8', title: 'Webinar de apresentação', type: 'Video' },
        { id: 'fnt9', title: 'Cases de sucesso', type: 'Copy' },
      ],
    },
    {
      id: 'fn4', type: 'stage', x: 900, y: 80, width: 220, color: '#ef4444',
      title: 'Oferta',
      description: 'Apresentar e vender o produto',
      tasks: [
        { id: 'fnt10', title: 'Página de vendas', type: 'Copy' },
        { id: 'fnt11', title: 'Vídeo de vendas (VSL)', type: 'Video' },
        { id: 'fnt12', title: 'Sequência de carrinho abandonado', type: 'Email' },
      ],
    },
    {
      id: 'fn5', type: 'stage', x: 1180, y: 80, width: 220, color: '#22c55e',
      title: 'Conversão',
      description: 'Fechar vendas e onboarding',
      tasks: [
        { id: 'fnt13', title: 'Checkout otimizado', type: 'Design' },
        { id: 'fnt14', title: 'Email de confirmação', type: 'Email' },
        { id: 'fnt15', title: 'Onboarding do cliente', type: 'Copy' },
      ],
    },
  ],
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      companies: seedCompanies,
      projects: seedProjects,
      tasks: seedTasks,
      personalTasks: [],
      teamMembers: seedTeamMembers,
      teams: [],
      templates: [],
      phaseTemplates: [],
      filters: defaultFilters,
      flows: [seedFlow],
      activeFlowId: null,
      activeCompanyId: null,
      activeProjectId: null,
      activeTaskId: null,
      view: 'dashboard',
      memberAccess: {},
      memberCompanyAccess: {},
      trash: [],
      currentUserId: null,
      isAuthenticated: false,
      darkMode: false,
      memberPasswords: {},
      deletedMemberIds: [],
      taskTypes: DEFAULT_TASK_TYPES,
      docEntries: [],

      setActiveCompany: (id) => set({ activeCompanyId: id, activeProjectId: null, view: id ? 'company' : 'dashboard' }),
      setActiveProject: (id) => set({ activeProjectId: id, view: id ? 'project' : 'company' }),
      setActiveTask: (id) => set({ activeTaskId: id }),
      setView: (view) => set({ view }),
      setCurrentUser: (id) => set({ currentUserId: id }),
      login: (email, password) => {
        const member = get().teamMembers.find(
          m => m.email?.toLowerCase() === email.trim().toLowerCase()
        );
        if (!member) return false;
        // Externos não têm acesso ao sistema
        if (member.permission === 'Externo') return false;
        // A password set by an admin must win over the hardcoded seed password,
        // otherwise changing a seed member's password silently has no effect.
        const expectedPw = get().memberPasswords[member.id] ?? MEMBER_PASSWORDS[member.id];
        if (!expectedPw || expectedPw !== password) return false;
        set({ isAuthenticated: true, currentUserId: member.id });
        return true;
      },
      logout: () => set({ isAuthenticated: false }),
      toggleDarkMode: () => set(s => ({ darkMode: !s.darkMode })),

      addTeamMember: (data, password) => set((s) => {
        const id = `tm-${Date.now()}`;
        const newMember: TeamMember = { id, ...data };
        return {
          teamMembers: [...s.teamMembers, newMember],
          memberPasswords: { ...s.memberPasswords, [id]: password },
          memberAccess: { ...s.memberAccess, [id]: s.projects.map(p => p.id) },
        };
      }),

      updateTeamMember: (id, data, newPassword) => set((s) => {
        const passwords = newPassword
          ? { ...s.memberPasswords, [id]: newPassword }
          : s.memberPasswords;
        return {
          teamMembers: s.teamMembers.map(m => m.id === id ? { ...m, ...data } : m),
          memberPasswords: passwords,
        };
      }),

      deleteTeamMember: (id) => set((s) => {
        const newMemberPasswords = { ...s.memberPasswords };
        delete newMemberPasswords[id];
        const newMemberAccess = { ...s.memberAccess };
        delete newMemberAccess[id];
        return {
          teamMembers: s.teamMembers.filter(m => m.id !== id),
          memberPasswords: newMemberPasswords,
          memberAccess: newMemberAccess,
          deletedMemberIds: [...s.deletedMemberIds, id],
          tasks: s.tasks.map(t => ({
            ...t,
            assigneeId: t.assigneeId === id ? undefined : t.assigneeId,
            assigneeIds: t.assigneeIds?.filter(aid => aid !== id),
          })),
          projects: s.projects.map(p => ({
            ...p,
            teamMemberIds: p.teamMemberIds.filter(mid => mid !== id),
          })),
        };
      }),
      // ── Teams ─────────────────────────────────────────────────────────────────
      addTeam: (name, color, companyId) => set((s) => ({
        teams: [...s.teams, {
          id: `team-${Date.now()}`,
          name,
          color,
          companyId,
          memberIds: [],
          createdAt: localISO(),
        }],
      })),
      updateTeam: (id, data) => set((s) => ({
        teams: s.teams.map(t => t.id === id ? { ...t, ...data } : t),
      })),
      deleteTeam: (id) => set((s) => ({
        teams: s.teams.filter(t => t.id !== id),
      })),
      addPersonToTeam: (teamId, memberId) => set((s) => ({
        teams: s.teams.map(t =>
          t.id === teamId && !t.memberIds.includes(memberId)
            ? { ...t, memberIds: [...t.memberIds, memberId] }
            : t
        ),
      })),
      removePersonFromTeam: (teamId, memberId) => set((s) => ({
        teams: s.teams.map(t =>
          t.id === teamId
            ? { ...t, memberIds: t.memberIds.filter(id => id !== memberId) }
            : t
        ),
      })),

      setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),

      // Append-only. The entry is never edited or replaced afterwards, so a post
      // cannot be clobbered by a later write to the same record.
      addDocEntry: (projectId, section, text) => set((s) => ({
        docEntries: [
          ...s.docEntries,
          {
            id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            projectId,
            section,
            text,
            authorId: s.currentUserId,
            createdAt: new Date().toISOString(),
          },
        ],
      })),

      // Removing a post moves it to the trash rather than dropping it, so the
      // record still exists and can be restored — the log stays a log.
      deleteDocEntry: (id) => set((s) => {
        const entry = s.docEntries.find(e => e.id === id);
        if (!entry) return s;
        const trashEntry: TrashItem = { id: trashId(), deletedAt: now(), type: 'docEntry', data: entry };
        return {
          docEntries: s.docEntries.filter(e => e.id !== id),
          trash: [...s.trash, trashEntry],
        };
      }),

      addPersonalTask: (taskData) => set((s) => ({
        personalTasks: [...s.personalTasks, {
          id: `pt-${Date.now()}`,
          createdAt: localISO(),
          ...taskData,
        }],
      })),
      updatePersonalTask: (id, updates) => set((s) => ({
        personalTasks: s.personalTasks.map(t => t.id === id ? { ...t, ...updates } : t),
      })),
      deletePersonalTask: (id) => set((s) => ({
        personalTasks: s.personalTasks.filter(t => t.id !== id),
      })),

      setActiveFlow: (id) => set({ activeFlowId: id, view: 'flow' }),
      addFlow: (flow) => set((s) => ({ flows: [...s.flows, flow] })),
      updateFlow: (id, patch) => set((s) => ({ flows: s.flows.map(f => f.id === id ? { ...f, ...patch } : f) })),
      deleteFlow: (id) => set((s) => {
        const flow = s.flows.find(f => f.id === id);
        if (!flow) return s;
        const entry: TrashItem = { id: trashId(), deletedAt: now(), type: 'flow', data: flow };
        return {
          flows: s.flows.filter(f => f.id !== id),
          activeFlowId: s.activeFlowId === id ? null : s.activeFlowId,
          trash: [...s.trash, entry],
        };
      }),
      addFlowNode: (flowId, node) => set((s) => ({ flows: s.flows.map(f => f.id !== flowId ? f : { ...f, nodes: [...f.nodes, node] }) })),
      updateFlowNode: (flowId, nodeId, patch) => set((s) => ({ flows: s.flows.map(f => f.id !== flowId ? f : { ...f, nodes: f.nodes.map(n => n.id === nodeId ? { ...n, ...patch } : n) }) })),
      deleteFlowNode: (flowId, nodeId) => set((s) => {
        const flow = s.flows.find(f => f.id === flowId);
        const node = flow?.nodes.find(n => n.id === nodeId);
        if (!node) return s;
        const entry: TrashItem = { id: trashId(), deletedAt: now(), type: 'flowNode', data: node, flowId };
        return {
          flows: s.flows.map(f => f.id !== flowId ? f : {
            ...f,
            nodes: f.nodes.filter(n => n.id !== nodeId),
            edges: f.edges.filter(e => e.fromId !== nodeId && e.toId !== nodeId),
          }),
          trash: [...s.trash, entry],
        };
      }),
      addFlowEdge: (flowId, edge) => set((s) => ({ flows: s.flows.map(f => f.id !== flowId ? f : { ...f, edges: [...f.edges, edge] }) })),
      deleteFlowEdge: (flowId, edgeId) => set((s) => ({ flows: s.flows.map(f => f.id !== flowId ? f : { ...f, edges: f.edges.filter(e => e.id !== edgeId) }) })),
      // Lanes may be absent on boards created before the feature — always ?? [].
      addFlowLane: (flowId, lane) => set((s) => {
        const flows = s.flows.map(f => f.id !== flowId ? f : { ...f, lanes: [...(f.lanes ?? []), lane] });
        const board = s.flows.find(f => f.id === flowId);
        // A new lane on a linked board becomes a phase of the project.
        if (!board?.linkedProjectId) return { flows };
        const projects = s.projects.map(p => {
          if (p.id !== board.linkedProjectId) return p;
          if (p.phases.some(ph => ph.name === lane.title)) return p;
          return { ...p, phases: [...p.phases, { id: `ph-${Date.now()}`, name: lane.title }] };
        });
        return { flows, projects };
      }),
      updateFlowLane: (flowId, laneId, patch) => set((s) => {
        const before = s.flows.find(f => f.id === flowId)?.lanes?.find(l => l.id === laneId);
        const flows = s.flows.map(f => f.id !== flowId ? f : { ...f, lanes: (f.lanes ?? []).map(l => l.id === laneId ? { ...l, ...patch } : l) });
        const board = flows.find(f => f.id === flowId);
        if (!board?.linkedProjectId || !before) return { flows };
        let projects = s.projects;
        let tasks = s.tasks;
        // Renaming a lane renames the matching phase (and migrates its tasks,
        // same as renamePhase); if the project had no such phase, create it.
        if (patch.title && patch.title !== before.title) {
          const proj = projects.find(p => p.id === board.linkedProjectId);
          if (proj) {
            if (proj.phases.some(ph => ph.name === before.title)) {
              projects = projects.map(p => p.id !== proj.id ? p : {
                ...p, phases: p.phases.map(ph => ph.name === before.title ? { ...ph, name: patch.title! } : ph),
              });
              tasks = tasks.map(t => t.projectId === proj.id && t.phase === before.title ? { ...t, phase: patch.title! } : t);
            } else if (!proj.phases.some(ph => ph.name === patch.title)) {
              projects = projects.map(p => p.id !== proj.id ? p : {
                ...p, phases: [...p.phases, { id: `ph-${Date.now()}`, name: patch.title! }],
              });
            }
          }
        }
        // Moving a lane keeps the project's phases in the same left→right order;
        // phases without a lane stay at the end, in their existing order.
        if (patch.x !== undefined || patch.width !== undefined || patch.title) {
          const laneOrder = [...(board.lanes ?? [])].sort((a, b) => a.x - b.x).map(l => l.title);
          projects = projects.map(p => {
            if (p.id !== board.linkedProjectId) return p;
            const byLane = laneOrder
              .map(t => p.phases.find(ph => ph.name === t))
              .filter((ph): ph is NonNullable<typeof ph> => !!ph);
            const rest = p.phases.filter(ph => !laneOrder.includes(ph.name));
            return { ...p, phases: [...byLane, ...rest] };
          });
        }
        return { flows, projects, tasks };
      }),
      deleteFlowLane: (flowId, laneId) => set((s) => ({ flows: s.flows.map(f => f.id !== flowId ? f : { ...f, lanes: (f.lanes ?? []).filter(l => l.id !== laneId) }) })),
      addFlowNodeTask: (flowId, nodeId, task) => set((s) => {
        const flows = s.flows.map(f => f.id !== flowId ? f : { ...f, nodes: f.nodes.map(n => n.id !== nodeId ? n : { ...n, tasks: [...n.tasks, task] }) });
        // Linked board: the task is also born in the project, twinned by id.
        const board = s.flows.find(f => f.id === flowId);
        const node = board?.nodes.find(n => n.id === nodeId);
        const linked = board?.linkedProjectId && s.projects.some(p => p.id === board.linkedProjectId);
        if (!board || !node || !linked) return { flows };
        const twin: Task = {
          id: `t${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          projectId: board.linkedProjectId!,
          phase: phaseForNode(board, node),
          title: task.title,
          type: (task.type ?? 'Copy') as TaskType,
          status: 'Backlog',
          priority: 'Medium',
          dueDate: localISO(new Date(Date.now() + 7 * 86400000)),
          createdAt: localISO(),
          flowTaskId: task.id,
          origin: 'flow',
        };
        return { flows, tasks: [...s.tasks, twin] };
      }),
      deleteFlowNodeTask: (flowId, nodeId, taskId) => set((s) => ({ flows: s.flows.map(f => f.id !== flowId ? f : { ...f, nodes: f.nodes.map(n => n.id !== nodeId ? n : { ...n, tasks: n.tasks.filter(t => t.id !== taskId) }) }) })),
      addFlowNodeSubtask: (flowId, nodeId, taskId, subtask) => set((s) => {
        const flows = s.flows.map(f => f.id !== flowId ? f : { ...f, nodes: f.nodes.map(n => n.id !== nodeId ? n : { ...n, tasks: n.tasks.map(t => t.id !== taskId ? t : { ...t, subtasks: [...(t.subtasks ?? []), subtask] }) }) });
        const board = s.flows.find(f => f.id === flowId);
        const parent = board?.linkedProjectId
          ? s.tasks.find(t => t.projectId === board.linkedProjectId && t.flowTaskId === taskId)
          : undefined;
        if (!board || !parent) return { flows };
        const twin: Task = {
          id: `t${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          projectId: parent.projectId,
          phase: parent.phase,
          title: subtask.title,
          type: parent.type,
          status: 'Backlog',
          priority: 'Medium',
          dueDate: parent.dueDate,
          createdAt: localISO(),
          parentTaskId: parent.id,
          flowTaskId: subtask.id,
          origin: 'flow',
        };
        return { flows, tasks: [...s.tasks, twin] };
      }),
      deleteFlowNodeSubtask: (flowId, nodeId, taskId, subtaskId) => set((s) => ({ flows: s.flows.map(f => f.id !== flowId ? f : { ...f, nodes: f.nodes.map(n => n.id !== nodeId ? n : { ...n, tasks: n.tasks.map(t => t.id !== taskId ? t : { ...t, subtasks: (t.subtasks ?? []).filter(st => st.id !== subtaskId) }) }) }) })),

      addCompany: (company) => set((s) => ({ companies: [...s.companies, company] })),
      deleteCompany: (id) => set((s) => {
        const company = s.companies.find(c => c.id === id);
        if (!company) return s;
        const projects = s.projects.filter(p => p.companyId === id);
        const projectIds = projects.map(p => p.id);
        const tasks = s.tasks.filter(t => projectIds.includes(t.projectId));
        const entry: TrashItem = { id: trashId(), deletedAt: now(), type: 'company', data: company, projects, tasks };
        return {
          companies: s.companies.filter(c => c.id !== id),
          projects: s.projects.filter(p => p.companyId !== id),
          tasks: s.tasks.filter(t => !projectIds.includes(t.projectId)),
          activeCompanyId: s.activeCompanyId === id ? null : s.activeCompanyId,
          activeProjectId: projectIds.includes(s.activeProjectId ?? '') ? null : s.activeProjectId,
          view: s.activeCompanyId === id ? 'dashboard' : s.view,
          trash: [...s.trash, entry],
        };
      }),

      updateMemberPermission: (memberId, permission) => set((s) => ({
        teamMembers: s.teamMembers.map(m => m.id === memberId ? { ...m, permission } : m),
      })),

      addProject: (project) => set((s) => {
        // Also grant memberAccess to every member listed in teamMemberIds
        const newAccess = { ...s.memberAccess };
        for (const memberId of (project.teamMemberIds ?? [])) {
          const existing = newAccess[memberId] ?? s.projects.map(p => p.id);
          if (!existing.includes(project.id)) {
            newAccess[memberId] = [...existing, project.id];
          }
        }
        return { projects: [...s.projects, project], memberAccess: newAccess };
      }),
      updateProject: (id, patch) => set((s) => ({
        projects: s.projects.map(p => p.id === id ? { ...p, ...patch } : p),
      })),
      deleteProject: (id) => set((s) => {
        const project = s.projects.find(p => p.id === id);
        if (!project) return s;
        const tasks = s.tasks.filter(t => t.projectId === id);
        const entry: TrashItem = { id: trashId(), deletedAt: now(), type: 'project', data: project, tasks };
        return {
          projects: s.projects.filter(p => p.id !== id),
          tasks: s.tasks.filter(t => t.projectId !== id),
          activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
          view: s.activeProjectId === id ? 'company' : s.view,
          trash: [...s.trash, entry],
        };
      }),

      addTask: (task) => set((s) => {
        // Tasks arriving FROM the flow already carry flowTaskId — adding them to
        // the flow again would loop. Only project-born tasks materialise there.
        const board = !task.flowTaskId
          ? s.flows.find(f => f.linkedProjectId === task.projectId)
          : undefined;
        if (!board) return { tasks: [...s.tasks, task] };

        const flowTaskId = `fnt${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        // Subtask: attach under the parent's flow twin, if the parent has one.
        if (task.parentTaskId) {
          const parent = s.tasks.find(t => t.id === task.parentTaskId);
          if (!parent?.flowTaskId) return { tasks: [...s.tasks, task] };
          const flows = s.flows.map(f => f.id !== board.id ? f : {
            ...f,
            nodes: f.nodes.map(n => ({
              ...n,
              tasks: n.tasks.map(t => t.id !== parent.flowTaskId ? t : {
                ...t, subtasks: [...(t.subtasks ?? []), { id: flowTaskId, title: task.title }],
              }),
            })),
          });
          return { flows, tasks: [...s.tasks, { ...task, flowTaskId }] };
        }

        // Top-level: goes into the leftmost node whose phase matches the task's.
        const host = board.nodes
          .filter(n => phaseForNode(board, n) === task.phase)
          .sort((a, b) => a.x - b.x)[0];
        if (!host) return { tasks: [...s.tasks, task] };
        const flows = s.flows.map(f => f.id !== board.id ? f : {
          ...f,
          nodes: f.nodes.map(n => n.id !== host.id ? n : {
            ...n,
            tasks: [...n.tasks, { id: flowTaskId, title: task.title, type: task.type, fromProject: true }],
          }),
        });
        return { flows, tasks: [...s.tasks, { ...task, flowTaskId }] };
      }),
      updateTask: (id, updates) =>
        set((s) => {
          const existing = s.tasks.find(t => t.id === id);
          const newStatus = (updates as Partial<Task>).status;
          const rec = existing?.recurrence;

          // ── Recurrence trigger (fires when task is marked Concluído) ──────
          // Guard on the TRANSITION, not the state: re-applying 'Concluído' to a
          // task that is already done (bulk status change, restore then re-tick)
          // used to spawn a second occurrence and bin the task again.
          if (rec && newStatus === 'Concluído' && existing!.status !== 'Concluído') {
            const nextDue = calcNextDueDate(existing!.dueDate, rec.type, rec.daysAfter);

            if (rec.createNewTask) {
              const newId = `t${Date.now()}`;
              const subtasks = s.tasks.filter(t => t.parentTaskId === id);
              // The checklist is part of the routine — carry it into the next
              // occurrence instead of leaving it behind in the trash, which made
              // the user rebuild the same subtasks by hand every single cycle.
              const newSubtasks: Task[] = subtasks.map((st, i) => ({
                ...st,
                id: `${newId}-s${i}`,
                parentTaskId: newId,
                status: 'Backlog' as TaskStatus,
                dueDate: nextDue,
                createdAt: localISO(),
              }));
              // Spawn the next occurrence (…updates first so the explicit
              // status/dueDate below still win, but other edits aren't dropped)
              const newTask: Task = {
                ...existing!,
                ...updates,
                id: newId,
                status: 'Backlog',
                dueDate: nextDue,
                phase: rec.targetPhase ?? existing!.phase,
                createdAt: localISO(),
                recurrence: rec.repeatForever ? rec : undefined,
              };

              // Old task (now Done) moves to trash — keeps history without cluttering the list
              const trashEntry: TrashItem = {
                id: trashId(),
                deletedAt: now(),
                type: 'task',
                data: { ...existing!, status: 'Concluído' },
                subtasks,
              };

              return {
                tasks: [
                  ...s.tasks.filter(t => t.id !== id && t.parentTaskId !== id),
                  newTask,
                  ...newSubtasks,
                ],
                trash: [...s.trash, trashEntry],
              };
            }

            // createNewTask is off: just update current task (reset status if configured)
            const finalUpdates: Partial<Task> = rec.resetStatus
              ? { ...updates, status: rec.resetStatusTo, dueDate: nextDue }
              : updates;

            return {
              tasks: s.tasks.map(t => t.id === id ? { ...t, ...finalUpdates } : t),
            };
          }
          // ── Normal update ────────────────────────────────────────────────
          return { tasks: s.tasks.map(t => t.id === id ? { ...t, ...updates } : t) };
        }),
      deleteTask: (id) => set((s) => {
        const task = s.tasks.find(t => t.id === id);
        if (!task) return s;
        const subtasks = s.tasks.filter(t => t.parentTaskId === id);
        const entry: TrashItem = { id: trashId(), deletedAt: now(), type: 'task', data: task, subtasks };
        return {
          tasks: s.tasks.filter(t => t.id !== id && t.parentTaskId !== id),
          trash: [...s.trash, entry],
        };
      }),
      moveTask: (taskId, newPhase, newStatus) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, phase: newPhase, status: newStatus } : t
          ),
        })),

      addTemplate: (template) =>
        set((s) => ({ templates: [...s.templates, template] })),
      deleteTemplate: (id) => set((s) => {
        const tpl = s.templates.find(t => t.id === id);
        if (!tpl) return s;
        const entry: TrashItem = { id: trashId(), deletedAt: now(), type: 'taskTemplate', data: tpl };
        return { templates: s.templates.filter(t => t.id !== id), trash: [...s.trash, entry] };
      }),
      applyTemplate: (templateId, projectId) =>
        set((s) => {
          const template = s.templates.find((t) => t.id === templateId);
          if (!template) return s;
          const today = localISO();
          const ts = Date.now();
          const newTasks: Task[] = [];

          template.tasks.forEach((tt, i) => {
            const parentId = `t${ts}-${i}`;
            newTasks.push({
              id: parentId,
              projectId,
              phase: tt.phase,
              title: tt.title,
              type: tt.type,
              status: 'Backlog' as TaskStatus,
              priority: tt.priority,
              description: tt.description,
              notes: tt.notes,
              dueDate: today,
              createdAt: today,
            });
            (tt.subtasks ?? []).forEach((st, j) => {
              newTasks.push({
                id: `t${ts}-${i}-s${j}`,
                projectId,
                phase: tt.phase,
                title: st.title,
                type: st.type,
                status: 'Backlog' as TaskStatus,
                priority: st.priority,
                description: st.description,
                notes: st.notes,
                dueDate: today,
                createdAt: today,
                parentTaskId: parentId,
              });
            });
          });

          // A template carries its source project's phase names. If the target
          // project has no column with that name the tasks land in no group and
          // are invisible in every view, so create the missing phases here.
          const target = s.projects.find(p => p.id === projectId);
          const existing = new Set((target?.phases ?? []).map(ph => ph.name));
          const missing = [...new Set(newTasks.map(t => t.phase))].filter(name => !existing.has(name));

          return {
            tasks: [...s.tasks, ...newTasks],
            projects: missing.length === 0 ? s.projects : s.projects.map(p =>
              p.id !== projectId ? p : {
                ...p,
                phases: [...p.phases, ...missing.map((name, i) => ({ id: `ph-${ts}-tpl${i}`, name }))],
              }
            ),
          };
        }),

      // ── Phase CRUD ──
      addPhase: (projectId, name) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id !== projectId ? p : {
              ...p,
              phases: [...p.phases, { id: `ph-${Date.now()}`, name }],
            }
          ),
        })),

      renamePhase: (projectId, phaseId, newName) =>
        set((s) => {
          // Find old name to bulk-rename tasks
          const project = s.projects.find(p => p.id === projectId);
          const oldPhase = project?.phases.find(ph => ph.id === phaseId);
          const oldName = oldPhase?.name ?? '';
          return {
            projects: s.projects.map((p) =>
              p.id !== projectId ? p : {
                ...p,
                phases: p.phases.map(ph => ph.id === phaseId ? { ...ph, name: newName } : ph),
              }
            ),
            // Bulk-rename tasks in this project that have the old phase name
            tasks: s.tasks.map(t =>
              t.projectId === projectId && t.phase === oldName
                ? { ...t, phase: newName }
                : t
            ),
          };
        }),

      deletePhase: (projectId, phaseId) =>
        set((s) => {
          const project = s.projects.find(p => p.id === projectId);
          if (!project) return s;
          const phaseToDelete = project.phases.find(ph => ph.id === phaseId);
          if (!phaseToDelete) return s;
          const remaining = project.phases.filter(ph => ph.id !== phaseId);
          // Deleting the last phase would leave every task with phase: '' — no
          // column matches that name, so the tasks vanish from the board and the
          // list with no way to get them back. Refuse instead.
          if (remaining.length === 0) return s;
          const fallback = remaining[0].name;
          const entry: TrashItem = { id: trashId(), deletedAt: now(), type: 'phase', data: phaseToDelete, projectId };
          return {
            projects: s.projects.map(p =>
              p.id !== projectId ? p : { ...p, phases: remaining }
            ),
            tasks: s.tasks.map(t =>
              t.projectId === projectId && t.phase === phaseToDelete.name
                ? { ...t, phase: fallback }
                : t
            ),
            trash: [...s.trash, entry],
          };
        }),

      reorderPhases: (projectId, phases) =>
        set((s) => ({
          projects: s.projects.map(p =>
            p.id !== projectId ? p : { ...p, phases }
          ),
        })),

      // ── Phase Templates ──
      addPhaseTemplate: (template) =>
        set((s) => ({ phaseTemplates: [...s.phaseTemplates, template] })),

      deletePhaseTemplate: (id) => set((s) => {
        const tpl = s.phaseTemplates.find(t => t.id === id);
        if (!tpl) return s;
        const entry: TrashItem = { id: trashId(), deletedAt: now(), type: 'phaseTemplate', data: tpl };
        return { phaseTemplates: s.phaseTemplates.filter(t => t.id !== id), trash: [...s.trash, entry] };
      }),

      // ── Custom Columns ──
      addCustomColumn: (projectId, col) =>
        set((s) => ({
          projects: s.projects.map(p =>
            p.id !== projectId ? p : {
              ...p,
              customColumns: [...(p.customColumns ?? []), { ...col, id: `cc-${Date.now()}` }],
            }
          ),
        })),

      removeCustomColumn: (projectId, colId) => set((s) => {
        const project = s.projects.find(p => p.id === projectId);
        const col = project?.customColumns?.find(c => c.id === colId);
        const entry: TrashItem | null = col
          ? { id: trashId(), deletedAt: now(), type: 'customColumn', data: col, projectId }
          : null;
        return {
          projects: s.projects.map(p =>
            p.id !== projectId ? p : {
              ...p,
              customColumns: (p.customColumns ?? []).filter(c => c.id !== colId),
            }
          ),
          trash: entry ? [...s.trash, entry] : s.trash,
        };
      }),

      renameCustomColumn: (projectId, colId, name) =>
        set((s) => ({
          projects: s.projects.map(p =>
            p.id !== projectId ? p : {
              ...p,
              customColumns: (p.customColumns ?? []).map(c => c.id === colId ? { ...c, name } : c),
            }
          ),
        })),

      setMemberProjectAccess: (memberId, projectId, hasAccess) =>
        set((s) => {
          const current = s.memberAccess[memberId] ?? s.projects.map(p => p.id);
          const updated = hasAccess
            ? [...new Set([...current, projectId])]
            : current.filter(id => id !== projectId);
          return { memberAccess: { ...s.memberAccess, [memberId]: updated } };
        }),

      setMemberAllAccess: (memberId, hasAccess) =>
        set((s) => ({
          memberAccess: {
            ...s.memberAccess,
            [memberId]: hasAccess ? s.projects.map(p => p.id) : [],
          },
        })),

      setMemberCompanyAccess: (memberId, companyId, hasAccess) =>
        set((s) => {
          const currentCompanies = s.memberCompanyAccess[memberId] ?? s.companies.map(c => c.id);
          const updatedCompanies = hasAccess
            ? [...new Set([...currentCompanies, companyId])]
            : currentCompanies.filter(id => id !== companyId);
          // When revoking company access, also revoke all its projects
          const currentProjects = s.memberAccess[memberId] ?? s.projects.map(p => p.id);
          const updatedProjects = hasAccess
            ? currentProjects
            : currentProjects.filter(pid => {
                const proj = s.projects.find(p => p.id === pid);
                return proj?.companyId !== companyId;
              });
          return {
            memberCompanyAccess: { ...s.memberCompanyAccess, [memberId]: updatedCompanies },
            memberAccess: { ...s.memberAccess, [memberId]: updatedProjects },
          };
        }),

      setMemberAllCompanyAccess: (memberId, hasAccess) =>
        set((s) => ({
          memberCompanyAccess: {
            ...s.memberCompanyAccess,
            [memberId]: hasAccess ? s.companies.map(c => c.id) : [],
          },
          memberAccess: {
            ...s.memberAccess,
            [memberId]: hasAccess ? s.projects.map(p => p.id) : [],
          },
        })),

      applyPhaseTemplate: (templateId, projectId) =>
        set((s) => {
          const template = s.phaseTemplates.find(t => t.id === templateId);
          if (!template) return s;
          const newPhases: ProjectPhase[] = template.phases.map((name, i) => ({
            id: `ph-${Date.now()}-${i}`,
            name,
          }));
          const project = s.projects.find(p => p.id === projectId);
          const oldPhaseNames = new Set((project?.phases ?? []).map(p => p.name));
          const newPhaseNames = new Set(newPhases.map(p => p.name));
          const fallback = newPhases[0]?.name ?? '';
          void get;
          return {
            projects: s.projects.map(p =>
              p.id !== projectId ? p : { ...p, phases: newPhases }
            ),
            tasks: s.tasks.map(t => {
              if (t.projectId !== projectId) return t;
              if (!oldPhaseNames.has(t.phase) || newPhaseNames.has(t.phase)) return t;
              return { ...t, phase: fallback };
            }),
          };
        }),

      // ── Task Types CRUD ────────────────────────────────────────────────────
      // Generates the project's flow view: one coloured lane per phase, one block
      // per phase holding its tasks, everything twinned (flowTaskId) so the two
      // views mirror additions and grey out one-sided deletions from then on.
      createFlowFromProject: (projectId) => set((s) => {
        const project = s.projects.find(p => p.id === projectId);
        if (!project) return s;
        if (s.flows.some(fl => fl.linkedProjectId === projectId)) return s; // already has one
        const ts = Date.now();
        const LANE_W = 360, GAP = 16, NODE_W = 250;
        const laneColors = ['#1f6feb', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#0ea5e9', '#ec4899'];

        const lanes: FlowLane[] = project.phases.map((ph, i) => ({
          id: `fl${ts}-${i}`,
          title: ph.name,
          color: laneColors[i % laneColors.length],
          x: 60 + i * (LANE_W + GAP),
          width: LANE_W,
        }));

        let taskPatches = new Map<string, string>(); // project task id -> flow task/subtask id
        const nodes: FlowNode[] = project.phases.map((ph, i) => {
          const phaseTasks = s.tasks.filter(t => t.projectId === projectId && t.phase === ph.name && !t.parentTaskId);
          const tasks: FlowNodeTask[] = phaseTasks.map((t, ti) => {
            const ftId = `fnt${ts}-${i}-${ti}`;
            taskPatches.set(t.id, ftId);
            const subs = s.tasks.filter(st => st.parentTaskId === t.id);
            return {
              id: ftId,
              title: t.title,
              type: t.type,
              subtasks: subs.map((st, si) => {
                const fsId = `fns${ts}-${i}-${ti}-${si}`;
                taskPatches.set(st.id, fsId);
                return { id: fsId, title: st.title };
              }),
            };
          });
          return {
            id: `fn${ts}-${i}`,
            type: 'stage' as const,
            x: 60 + i * (LANE_W + GAP) + (LANE_W - NODE_W) / 2,
            y: 120,
            width: NODE_W,
            title: ph.name,
            color: laneColors[i % laneColors.length],
            tasks,
          };
        });

        const edges: FlowEdge[] = nodes.slice(0, -1).map((n, i) => ({
          id: `fe${ts}-${i}`,
          fromId: n.id,
          toId: nodes[i + 1].id,
        }));

        const board: FlowBoard = {
          id: `flow-${ts}`,
          name: project.name,
          description: project.description,
          nodes,
          edges,
          lanes,
          linkedProjectId: projectId,
          createdAt: localISO(),
        };

        return {
          flows: [...s.flows, board],
          tasks: s.tasks.map(t => taskPatches.has(t.id) ? { ...t, flowTaskId: taskPatches.get(t.id) } : t),
        };
      }),

      addTaskType: (type) => set((s) => ({ taskTypes: [...s.taskTypes, type] })),
      updateTaskType: (value, patch) => set((s) => ({
        taskTypes: s.taskTypes.map(t => t.value === value ? { ...t, ...patch } : t),
      })),
      deleteTaskType: (value) => set((s) => ({
        taskTypes: s.taskTypes.filter(t => t.value !== value),
      })),
      reorderTaskTypes: (types) => set({ taskTypes: types }),

      // ── Trash ──────────────────────────────────────────────────────────────
      restoreFromTrash: (trashItemId) => set((s) => {
        const item = s.trash.find(t => t.id === trashItemId);
        if (!item) return s;
        const remaining = { trash: s.trash.filter(t => t.id !== trashItemId) };
        switch (item.type) {
          case 'company':
            return { ...remaining, companies: [...s.companies, item.data], projects: [...s.projects, ...item.projects], tasks: [...s.tasks, ...item.tasks] };
          case 'project':
            return { ...remaining, projects: [...s.projects, item.data], tasks: [...s.tasks, ...item.tasks] };
          case 'task':
            return { ...remaining, tasks: [...s.tasks, item.data, ...item.subtasks] };
          case 'flow':
            return { ...remaining, flows: [...s.flows, item.data] };
          case 'flowNode': {
            const flowExists = s.flows.some(f => f.id === item.flowId);
            if (!flowExists) return remaining;
            return { ...remaining, flows: s.flows.map(f => f.id !== item.flowId ? f : { ...f, nodes: [...f.nodes, item.data] }) };
          }
          case 'taskTemplate':
            return { ...remaining, templates: [...s.templates, item.data] };
          case 'phaseTemplate':
            return { ...remaining, phaseTemplates: [...s.phaseTemplates, item.data] };
          case 'phase':
            return { ...remaining, projects: s.projects.map(p => p.id !== item.projectId ? p : { ...p, phases: [...p.phases, item.data] }) };
          case 'customColumn':
            return { ...remaining, projects: s.projects.map(p => p.id !== item.projectId ? p : { ...p, customColumns: [...(p.customColumns ?? []), item.data] }) };
          case 'docEntry': {
            // Guard against a duplicate: another device may have restored it
            // already, and two records with the same id break React keys and
            // the per-entity sync merge.
            if (s.docEntries.some(e => e.id === item.data.id)) return remaining;
            return { ...remaining, docEntries: [...s.docEntries, item.data] };
          }
          default:
            return remaining;
        }
      }),

      permanentlyDeleteFromTrash: (trashItemId) => set((s) => ({
        trash: s.trash.filter(t => t.id !== trashItemId),
      })),

      clearTrash: () => set({ trash: [] }),

      purgeExpiredTrash: () => set((s) => ({
        trash: s.trash.filter(item => !isExpired(item.deletedAt)),
      })),
    }),
    {
      name: 'marketflow-store',
      version: 13,
      migrate: (persistedState: any) => {
        // A null/!object persisted blob would make the assignments below throw,
        // and a throw here aborts hydration and blanks the app with no recovery
        // path other than clearing site data. Fall back to a clean slate instead.
        if (!persistedState || typeof persistedState !== 'object') return persistedState;
        // v0 → v1: add phases to projects that were saved without them
        if (persistedState?.projects) {
          persistedState.projects = persistedState.projects.map((p: any) =>
            p.phases ? p : {
              ...p,
              phases: DEFAULT_PHASES.map((ph, i) => ({ id: `${p.id}-ph-${i}`, name: ph.name })),
            }
          );
        }
        // v1 → v2: add customColumns to projects that don't have them
        if (persistedState?.projects) {
          persistedState.projects = persistedState.projects.map((p: any) =>
            p.customColumns ? p : { ...p, customColumns: [] }
          );
        }
        // v2 → v3: initialize memberAccess from existing project teamMemberIds
        if (!persistedState?.memberAccess) {
          persistedState.memberAccess = {};
        }
        if (persistedState?.projects && persistedState?.teamMembers) {
          persistedState.teamMembers.forEach((m: any) => {
            if (!persistedState.memberAccess[m.id]) {
              persistedState.memberAccess[m.id] = persistedState.projects
                .filter((p: any) => p.teamMemberIds?.includes(m.id))
                .map((p: any) => p.id);
            }
          });
        }
        // v3 → v4: migrate task phase names from English to PT-BR
        const phaseNameMap: Record<string, string> = {
          'Strategy':   'Estratégia',
          'Production': 'Produção',
          'Review':     'Revisão',
          'Launch':     'Lançamento',
          'Analysis':   'Análise',
        };
        if (persistedState?.tasks) {
          persistedState.tasks = persistedState.tasks.map((t: any) =>
            phaseNameMap[t.phase] ? { ...t, phase: phaseNameMap[t.phase] } : t
          );
        }
        // v4 → v5: add flows array
        if (!persistedState?.flows) {
          persistedState.flows = [seedFlow];
        }
        if (persistedState.activeFlowId === undefined) {
          persistedState.activeFlowId = null;
        }
        // v5 → v6: add trash array
        if (!persistedState?.trash) {
          persistedState.trash = [];
        }
        // v6 → v7: add currentUserId
        if (persistedState.currentUserId === undefined) {
          persistedState.currentUserId = null;
        }
        // v7 → v8: add isAuthenticated + sync all seed fields on team members
        if (persistedState.isAuthenticated === undefined) {
          persistedState.isAuthenticated = false;
        }
        if (persistedState?.teamMembers) {
          persistedState.teamMembers = persistedState.teamMembers.map((m: any) => {
            const seed = seedTeamMembers.find(s => s.id === m.id);
            if (!seed) return m;
            return { ...seed, permission: m.permission ?? seed.permission };
          });
          // Add any new seed members not yet in the persisted list
          seedTeamMembers.forEach(s => {
            if (!persistedState.teamMembers.find((m: any) => m.id === s.id)) {
              persistedState.teamMembers.unshift(s);
            }
          });
        }
        // v8 → v9: add memberPasswords and deletedMemberIds
        if (!persistedState.memberPasswords) persistedState.memberPasswords = {};
        if (!persistedState.deletedMemberIds) persistedState.deletedMemberIds = [];
        // v9 → v10: add personalTasks
        if (!persistedState.personalTasks) persistedState.personalTasks = [];
        // v10 → v11: add memberCompanyAccess (derive from existing project access)
        if (!persistedState.memberCompanyAccess) {
          persistedState.memberCompanyAccess = {};
          if (persistedState.teamMembers && persistedState.projects) {
            persistedState.teamMembers.forEach((m: any) => {
              const projectIds: string[] = persistedState.memberAccess?.[m.id]
                ?? persistedState.projects.map((p: any) => p.id);
              const companyIds = [...new Set(
                persistedState.projects
                  .filter((p: any) => projectIds.includes(p.id))
                  .map((p: any) => p.companyId)
              )];
              persistedState.memberCompanyAccess[m.id] = companyIds;
            });
          }
        }
        // v11 → v12: migrate task statuses from English to Portuguese
        const statusMigrationMap: Record<string, string> = {
          'Not Started': 'Backlog',
          'In Progress': 'Em andamento',
          'Review':      'Em revisão',
          'Done':        'Concluído',
          'Blocked':     'Bloqueado',
        };
        if (persistedState?.tasks) {
          persistedState.tasks = persistedState.tasks.map((t: any) =>
            statusMigrationMap[t.status] ? { ...t, status: statusMigrationMap[t.status] } : t
          );
        }
        if (persistedState?.personalTasks) {
          persistedState.personalTasks = persistedState.personalTasks.map((t: any) =>
            statusMigrationMap[t.status] ? { ...t, status: statusMigrationMap[t.status] } : t
          );
        }
        // Reset filters.status if it holds an old value
        if (persistedState?.filters?.status && statusMigrationMap[persistedState.filters.status]) {
          persistedState.filters.status = statusMigrationMap[persistedState.filters.status];
        }
        // Migrate recurrence resetStatusTo fields
        if (persistedState?.tasks) {
          persistedState.tasks = persistedState.tasks.map((t: any) => {
            if (t.recurrence?.resetStatusTo && statusMigrationMap[t.recurrence.resetStatusTo]) {
              return { ...t, recurrence: { ...t.recurrence, resetStatusTo: statusMigrationMap[t.recurrence.resetStatusTo] } };
            }
            return t;
          });
        }

        // v12 → v13: add taskTypes
        if (!persistedState.taskTypes) persistedState.taskTypes = DEFAULT_TASK_TYPES;

        return persistedState;
      },
      partialize: (state) => ({
        tasks: state.tasks,
        personalTasks: state.personalTasks,
        companies: state.companies,
        projects: state.projects,
        teamMembers: state.teamMembers,
        teams: state.teams,
        templates: state.templates,
        phaseTemplates: state.phaseTemplates,
        memberAccess: state.memberAccess,
        memberCompanyAccess: state.memberCompanyAccess,
        flows: state.flows,
        activeFlowId: state.activeFlowId,
        trash: state.trash,
        currentUserId: state.currentUserId,
        isAuthenticated: state.isAuthenticated,
        darkMode: state.darkMode,
        memberPasswords: state.memberPasswords,
        deletedMemberIds: state.deletedMemberIds,
        taskTypes: state.taskTypes,
        docEntries: state.docEntries,
      }),
      merge: (persisted: any, current) => {
        const merged = { ...current, ...persisted };
        // An empty array is a deliberate user choice (they deleted every board) —
        // only seed when the key is absent entirely, i.e. a fresh install.
        // Otherwise the seed board reappeared on every reload, un-deletable.
        if (!merged.flows) merged.flows = [seedFlow];
        if (merged.activeFlowId === undefined) merged.activeFlowId = null;
        if (!merged.trash) merged.trash = [];
        if (merged.currentUserId === undefined) merged.currentUserId = null;
        if (merged.isAuthenticated === undefined) merged.isAuthenticated = false;
        if (!merged.memberPasswords) merged.memberPasswords = {};
        if (!merged.deletedMemberIds) merged.deletedMemberIds = [];
        if (!merged.personalTasks) merged.personalTasks = [];
        if (!merged.memberCompanyAccess) merged.memberCompanyAccess = {};
        if (!merged.taskTypes) merged.taskTypes = DEFAULT_TASK_TYPES;
        if (!merged.teams) merged.teams = [];
        if (!merged.docEntries) merged.docEntries = [];
        // Seed companies are only planted on a FRESH install (no persisted array).
        // Re-adding them on every hydration resurrected companies the user had
        // deleted — they reappeared on every reload and could never be removed.
        // Existing entries keep their persisted values; seed only backfills
        // fields a stored company is missing.
        if (merged.companies) {
          merged.companies = merged.companies.map((c: any) =>
            SEED_COMPANY_IDS.has(c.id)
              ? { ...seedCompanies.find(s => s.id === c.id)!, ...c }
              : c
          );
        } else {
          merged.companies = [...seedCompanies];
        }

        // Always sync seed team members — update ALL fields from seed (name, role, avatar,
        // color, email) while keeping the admin-set permission.
        // Skip members that were explicitly deleted by an admin.
        if (merged.teamMembers) {
          const deletedIds: string[] = merged.deletedMemberIds ?? [];
          merged.teamMembers = merged.teamMembers
            .filter((m: any) => !SEED_MEMBER_IDS.has(m.id) || !deletedIds.includes(m.id))
            .map((m: any) => {
              const seed = seedTeamMembers.find(s => s.id === m.id);
              if (!seed) return m; // user-created member — keep as-is
              // Seed only fills in fields the persisted member is missing.
              // Spreading `m` last is essential: otherwise every admin edit to a
              // seed member (name, email, role, colour) is reverted on reload,
              // and since email is the login key they also lose access.
              return { ...seed, ...m };
            });
          seedTeamMembers.forEach(s => {
            if (!deletedIds.includes(s.id) && !merged.teamMembers.find((m: any) => m.id === s.id)) {
              merged.teamMembers.unshift(s);
            }
          });
        }
        // Auto-purge expired items on hydration
        merged.trash = merged.trash.filter((item: any) => !isExpired(item.deletedAt));

        // Security: if the persisted session belongs to a user who was deleted,
        // clear the auth state so they're redirected to the login screen.
        if (merged.isAuthenticated && merged.currentUserId) {
          const deletedIds: string[] = merged.deletedMemberIds ?? [];
          const stillExists = (merged.teamMembers ?? []).some(
            (m: any) => m.id === merged.currentUserId
          );
          if (!stillExists || deletedIds.includes(merged.currentUserId)) {
            merged.isAuthenticated = false;
            merged.currentUserId   = null;
          }
        }

        return merged;
      },
    }
  )
);

// Selectors
export const selectCompanyProjects = (companyId: string) => (state: AppState) =>
  state.projects.filter((p) => p.companyId === companyId);

export const selectProjectTasks = (projectId: string) => (state: AppState) =>
  state.tasks.filter((t) => t.projectId === projectId);

export const selectCompanyHealth = (companyId: string) => (state: AppState) => {
  const projects = state.projects.filter((p) => p.companyId === companyId);
  const projectIds = projects.map((p) => p.id);
  const tasks = state.tasks.filter((t) => projectIds.includes(t.projectId));
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === 'Concluído').length;
  return Math.round((done / tasks.length) * 100);
};

export const selectNextDeadline = (companyId: string) => (state: AppState) => {
  const projects = state.projects.filter((p) => p.companyId === companyId);
  const projectIds = projects.map((p) => p.id);
  const today = localISO();
  const upcoming = state.tasks
    .filter((t) => projectIds.includes(t.projectId) && t.dueDate >= today && t.status !== 'Concluído')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return upcoming[0]?.dueDate ?? null;
};
