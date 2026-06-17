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

export default function App() {
  const { view, activeTaskId, addTask, activeProjectId, projects, isAuthenticated, darkMode, teamMembers, currentUserId, logout } = useAppStore();
  const currentMember = teamMembers.find(m => m.id === currentUserId);
  const isAdmin        = currentMember?.permission === 'Admin';
  const isVisualizador = currentMember?.permission === 'Visualizador';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Supabase sync — load on mount, save on change, listen for remote updates
  useEffect(() => {
    loadFromSupabase().then(() => {
      // Deep-link: ?task=TASK_ID opens the task modal directly
      const params = new URLSearchParams(window.location.search);
      const taskId = params.get('task');
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
          // Remove the param from the URL bar without reloading
          const clean = window.location.pathname;
          window.history.replaceState({}, '', clean);
        }
      }
    });
    const channel = subscribeToRealtime();
    const unsubscribe = useAppStore.subscribe((state) => scheduleSave(state));
    return () => {
      channel.unsubscribe();
      unsubscribe();
    };
  }, []);

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

  if (!isAuthenticated) return <LoginView />;

  const handleNewTask = activeProjectId ? () => {
    const project = projects.find(p => p.id === activeProjectId);
    if (!project) return;
    const newTask = {
      id: `t${Date.now()}`,
      projectId: activeProjectId,
      phase: project.phases[0]?.name ?? 'Production',
      title: 'New task',
      type: 'Copy' as const,
      status: 'Backlog' as const,
      priority: 'Medium' as const,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      createdAt: new Date().toISOString().split('T')[0],
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
          {view === 'company' && !isVisualizador && <CompanyView />}
          {view === 'project' && <KanbanBoard />}
          {view === 'users' && isAdmin && <UserManagementView />}
          {view === 'flow' && <FlowView />}
          {view === 'trash' && <TrashView />}
          {view === 'schedule' && <ScheduleView />}
          {view === 'backup'   && <BackupView />}
        </main>
      </div>

      {activeTaskId && <TaskModal />}
    </div>
  );
}
