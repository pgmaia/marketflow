import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import { loadFromSupabase, scheduleSave, subscribeToRealtime } from './lib/syncSupabase';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { DashboardView } from './components/dashboard/DashboardView';
import { VisualizadorView } from './components/dashboard/VisualizadorView';
import { CompanyView } from './components/dashboard/CompanyView';
import { KanbanBoard } from './components/project/KanbanBoard';
import { TaskModal } from './components/task/TaskModal';
import { UserManagementView } from './components/users/UserManagementView';
import { FlowView } from './components/flow/FlowView';
import { TrashView } from './components/trash/TrashView';
import { LoginView } from './components/auth/LoginView';
import { ScheduleView } from './components/schedule/ScheduleView';
import { BackupView } from './components/backup/BackupView';
import { localISO } from './lib/date';

export default function App() {
  const { view, activeTaskId, addTask, activeProjectId, projects, isAuthenticated, darkMode, teamMembers, currentUserId, logout } = useAppStore();
  const currentMember = teamMembers.find(m => m.id === currentUserId);
  const isAdmin        = currentMember?.permission === 'Admin';
  const isVisualizador = currentMember?.permission === 'Visualizador';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Supabase sync — runs only for an authenticated session. With RLS on, a
  // pre-login load would just fail; and the Realtime socket must carry the
  // user's token, which only exists after sign-in. Re-runs on login/logout.
  useEffect(() => {
    if (!isAuthenticated) return;
    loadFromSupabase().then(() => {
      const params = new URLSearchParams(window.location.search);
      const taskId = params.get('task');
      const projectId = params.get('project');

      // Deep-link: ?task=TASK_ID opens the task modal directly
      if (taskId) {
        const { tasks, projects, companies, setActiveCompany, setActiveProject, setActiveTask } = useAppStore.getState();
        const target = tasks.find(t => t.id === taskId);
        if (target) {
          const project = projects.find(p => p.id === target.projectId);
          if (project) {
            const company = companies.find(c => c.id === project.companyId);
            if (company) setActiveCompany(company.id);
            setActiveProject(project.id);
          }
          setActiveTask(taskId);
          window.history.replaceState({}, '', window.location.pathname);
        }
      }

      // Deep-link: ?project=PROJECT_ID navigates directly to the project
      if (projectId && !taskId) {
        const { projects, companies, setActiveCompany, setActiveProject, setView } = useAppStore.getState();
        const project = projects.find(p => p.id === projectId);
        if (project) {
          const company = companies.find(c => c.id === project.companyId);
          if (company) setActiveCompany(company.id);
          setActiveProject(project.id);
          setView('project');
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    });
    const channel = subscribeToRealtime();
    const unsubscribe = useAppStore.subscribe((state) => scheduleSave(state));
    return () => {
      channel.unsubscribe();
      unsubscribe();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Security: if the current user was deleted while they had an active session
  // (detected via real-time Supabase update), force immediate logout.
  useEffect(() => {
    if (isAuthenticated && currentUserId && !currentMember) {
      logout();
    }
  }, [isAuthenticated, currentUserId, currentMember, logout]);

  // Admin-only routes render nothing for everyone else, so a user who lands on
  // one (switching account from the sidebar picker, or losing the permission
  // while the tab is open) would stare at an empty content area. Send them home.
  useEffect(() => {
    if (!isAdmin && (view === 'users' || view === 'trash' || view === 'backup')) {
      useAppStore.getState().setView('dashboard');
    }
  }, [isAdmin, view]);

  if (!isAuthenticated) return <LoginView />;

  // activeProjectId survives navigation to Trash/Backup/Schedule, so the button
  // stayed enabled there and dropped a task into the previously open project —
  // out of sight, with a modal opening on top of an unrelated screen.
  const canCreateTask = !!activeProjectId && (view === 'project' || view === 'company');
  const handleNewTask = canCreateTask ? () => {
    const project = projects.find(p => p.id === activeProjectId);
    if (!project) return;
    const newTask = {
      id: `t${Date.now()}`,
      projectId: activeProjectId,
      phase: project.phases[0]?.name ?? 'Backlog',
      title: 'Nova tarefa',
      type: 'Copy' as const,
      status: 'Backlog' as const,
      priority: 'Medium' as const,
      dueDate: localISO(new Date(Date.now() + 7 * 86400000)),
      createdAt: localISO(),
    };
    addTask(newTask);
    setTimeout(() => useAppStore.getState().setActiveTask(newTask.id), 50);
  } : undefined;

  const isFullscreenView = view === 'project' || view === 'flow';

  return (
    <div className="flex w-full h-screen overflow-hidden bg-white">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      {/* Floating hamburger — only on mobile, only for views without a TopBar */}
      {isFullscreenView && !mobileMenuOpen && (
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="fixed top-3.5 left-3.5 z-40 md:hidden w-8 h-8 bg-white shadow-md rounded-lg flex items-center justify-center border border-gray-100"
        >
          <Menu size={16} className="text-gray-600" />
        </button>
      )}

      <div className="flex flex-col flex-1 min-h-0 min-w-0">
        {!isFullscreenView && <TopBar onNewTask={handleNewTask} onMenuToggle={() => setMobileMenuOpen(v => !v)} />}

        <main className="flex flex-1 min-h-0 overflow-hidden">
          {view === 'dashboard' && (isVisualizador ? <VisualizadorView /> : <DashboardView />)}
          {view === 'company' && (isVisualizador ? <VisualizadorView /> : <CompanyView />)}
          {view === 'project' && <KanbanBoard />}
          {view === 'users' && isAdmin && <UserManagementView />}
          {view === 'flow' && <FlowView />}
          {view === 'trash' && isAdmin && <TrashView />}
          {view === 'schedule' && <ScheduleView />}
          {view === 'backup'   && isAdmin && <BackupView />}
        </main>
      </div>

      {activeTaskId && <TaskModal />}
    </div>
  );
}
