import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Company, CustomColumn, Project, ProjectPhase, PhaseTemplate, Task, TaskTemplate, TeamMember, AppFilters, TaskStatus, FlowBoard, FlowNode, FlowEdge, FlowNodeTask, UserPermission, TrashItem } from '../types';
import { seedCompanies, seedProjects, seedTasks, seedTeamMembers, DEFAULT_PHASES, MEMBER_PASSWORDS } from '../data/seed';

type AppView = 'dashboard' | 'company' | 'project' | 'users' | 'flow' | 'trash';

interface AppState {
  companies: Company[];
  projects: Project[];
  tasks: Task[];
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

  // Navigation
  activeCompanyId: string | null;
  activeProjectId: string | null;
  activeTaskId: string | null;
  view: AppView;
  memberAccess: Record<string, string[]>;

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
  deleteTeamMember: (id: string) => void;
  setMemberProjectAccess: (memberId: string, projectId: string, hasAccess: boolean) => void;
  setMemberAllAccess: (memberId: string, hasAccess: boolean) => void;
  setFilters: (filters: Partial<AppFilters>) => void;

  // Flow actions
  setActiveFlow: (id: string | null) => void;
  addFlow: (flow: FlowBoard) => void;
  updateFlow: (id: string, patch: Partial<FlowBoard>) => void;
  deleteFlow: (id: string) => void;
  updateFlowNode: (flowId: string, nodeId: string, patch: Partial<FlowNode>) => void;
  addFlowNode: (flowId: string, node: FlowNode) => void;
  deleteFlowNode: (flowId: string, nodeId: string) => void;
  addFlowEdge: (flowId: string, edge: FlowEdge) => void;
  deleteFlowEdge: (flowId: string, edgeId: string) => void;
  addFlowNodeTask: (flowId: string, nodeId: string, task: FlowNodeTask) => void;
  deleteFlowNodeTask: (flowId: string, nodeId: string, taskId: string) => void;

  // Company CRUD
  addCompany: (company: Company) => void;
  deleteCompany: (id: string) => void;

  // Member permissions
  updateMemberPermission: (memberId: string, permission: UserPermission) => void;

  // Project CRUD
  addProject: (project: Project) => void;
  updateProject: (id: string, patch: Partial<Pick<Project, 'name' | 'description' | 'color' | 'startDate' | 'endDate'>>) => void;
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

const seedFlow: FlowBoard = {
  id: 'flow-1',
  name: 'Funil de Vendas Padrão',
  description: 'Fluxo completo de funil de marketing e vendas',
  createdAt: new Date().toISOString().split('T')[0],
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
      teamMembers: seedTeamMembers,
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
      trash: [],
      currentUserId: null,
      isAuthenticated: false,
      darkMode: false,
      memberPasswords: {},
      deletedMemberIds: [],

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
        const expectedPw = MEMBER_PASSWORDS[member.id] ?? get().memberPasswords[member.id];
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
          tasks: s.tasks.map(t => t.assigneeId === id ? { ...t, assigneeId: undefined } : t),
          projects: s.projects.map(p => ({
            ...p,
            teamMemberIds: p.teamMemberIds.filter(mid => mid !== id),
          })),
        };
      }),
      setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),

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
      addFlowNodeTask: (flowId, nodeId, task) => set((s) => ({ flows: s.flows.map(f => f.id !== flowId ? f : { ...f, nodes: f.nodes.map(n => n.id !== nodeId ? n : { ...n, tasks: [...n.tasks, task] }) }) })),
      deleteFlowNodeTask: (flowId, nodeId, taskId) => set((s) => ({ flows: s.flows.map(f => f.id !== flowId ? f : { ...f, nodes: f.nodes.map(n => n.id !== nodeId ? n : { ...n, tasks: n.tasks.filter(t => t.id !== taskId) }) }) })),

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

      addProject: (project) => set((s) => ({ projects: [...s.projects, project] })),
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

      addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),
      updateTask: (id, updates) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)) })),
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
          const today = new Date().toISOString().split('T')[0];
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
              status: 'Not Started' as TaskStatus,
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
                status: 'Not Started' as TaskStatus,
                priority: st.priority,
                description: st.description,
                notes: st.notes,
                dueDate: today,
                createdAt: today,
                parentTaskId: parentId,
              });
            });
          });

          return { tasks: [...s.tasks, ...newTasks] };
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
          const fallback = remaining[0]?.name ?? '';
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
      version: 9,
      migrate: (persistedState: any) => {
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
        // v7 → v8: add isAuthenticated + backfill email on team members
        if (persistedState.isAuthenticated === undefined) {
          persistedState.isAuthenticated = false;
        }
        if (persistedState?.teamMembers) {
          persistedState.teamMembers = persistedState.teamMembers.map((m: any) => {
            const seed = seedTeamMembers.find(s => s.id === m.id);
            return seed ? { ...m, email: m.email ?? seed.email, permission: m.permission ?? seed.permission } : m;
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

        return persistedState;
      },
      partialize: (state) => ({
        tasks: state.tasks,
        companies: state.companies,
        projects: state.projects,
        teamMembers: state.teamMembers,
        templates: state.templates,
        phaseTemplates: state.phaseTemplates,
        memberAccess: state.memberAccess,
        flows: state.flows,
        activeFlowId: state.activeFlowId,
        trash: state.trash,
        currentUserId: state.currentUserId,
        isAuthenticated: state.isAuthenticated,
        darkMode: state.darkMode,
        memberPasswords: state.memberPasswords,
        deletedMemberIds: state.deletedMemberIds,
      }),
      merge: (persisted: any, current) => {
        const merged = { ...current, ...persisted };
        if (!merged.flows || merged.flows.length === 0) merged.flows = [seedFlow];
        if (merged.activeFlowId === undefined) merged.activeFlowId = null;
        if (!merged.trash) merged.trash = [];
        if (merged.currentUserId === undefined) merged.currentUserId = null;
        if (merged.isAuthenticated === undefined) merged.isAuthenticated = false;
        if (!merged.memberPasswords) merged.memberPasswords = {};
        if (!merged.deletedMemberIds) merged.deletedMemberIds = [];
        // Always ensure all seed members are present with up-to-date email/permission
        // (skipping any that were explicitly deleted by an admin)
        if (merged.teamMembers) {
          merged.teamMembers = merged.teamMembers.map((m: any) => {
            const seed = seedTeamMembers.find(s => s.id === m.id);
            return seed ? { ...m, email: m.email ?? seed.email, permission: m.permission ?? seed.permission } : m;
          });
          const deletedIds: string[] = merged.deletedMemberIds ?? [];
          seedTeamMembers.forEach(s => {
            if (!deletedIds.includes(s.id) && !merged.teamMembers.find((m: any) => m.id === s.id)) {
              merged.teamMembers.unshift(s);
            }
          });
        }
        // Auto-purge expired items on hydration
        merged.trash = merged.trash.filter((item: any) => !isExpired(item.deletedAt));
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
  const done = tasks.filter((t) => t.status === 'Done').length;
  return Math.round((done / tasks.length) * 100);
};

export const selectNextDeadline = (companyId: string) => (state: AppState) => {
  const projects = state.projects.filter((p) => p.companyId === companyId);
  const projectIds = projects.map((p) => p.id);
  const today = new Date().toISOString().split('T')[0];
  const upcoming = state.tasks
    .filter((t) => projectIds.includes(t.projectId) && t.dueDate >= today && t.status !== 'Done')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return upcoming[0]?.dueDate ?? null;
};
