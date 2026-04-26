import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { DashboardView } from './components/dashboard/DashboardView';
import { CompanyView } from './components/dashboard/CompanyView';
import { KanbanBoard } from './components/project/KanbanBoard';
import { TaskModal } from './components/task/TaskModal';
import { UserManagementView } from './components/users/UserManagementView';
import { FlowView } from './components/flow/FlowView';
import { TrashView } from './components/trash/TrashView';
import { LoginView } from './components/auth/LoginView';
import { ScheduleView } from './components/schedule/ScheduleView';

export default function App() {
  const { view, activeTaskId, addTask, activeProjectId, projects, isAuthenticated, darkMode } = useAppStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

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
      status: 'Not Started' as const,
      priority: 'Medium' as const,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      createdAt: new Date().toISOString().split('T')[0],
    };
    addTask(newTask);
    setTimeout(() => useAppStore.getState().setActiveTask(newTask.id), 50);
  } : undefined;

  return (
    <div className="flex w-full min-h-screen bg-white">
      <Sidebar />

      <div className="flex flex-col flex-1 min-h-screen min-w-0">
        {view !== 'project' && view !== 'flow' && <TopBar onNewTask={handleNewTask} />}

        <main className="flex flex-1 min-h-0 overflow-hidden">
          {view === 'dashboard' && <DashboardView />}
          {view === 'company' && <CompanyView />}
          {view === 'project' && <KanbanBoard />}
          {view === 'users' && <UserManagementView />}
          {view === 'flow' && <FlowView />}
          {view === 'trash' && <TrashView />}
          {view === 'schedule' && <ScheduleView />}
        </main>
      </div>

      {activeTaskId && <TaskModal />}
    </div>
  );
}
