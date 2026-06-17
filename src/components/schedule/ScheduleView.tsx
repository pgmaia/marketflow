import { useState } from 'react';
import { CalendarDays, ListTodo } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { MyTasksTab } from './MyTasksTab';
import { AgendaTab } from './AgendaTab';

type Tab = 'tasks' | 'agenda';

export function ScheduleView() {
  const [activeTab, setActiveTab] = useState<Tab>('tasks');
  const { teamMembers, currentUserId, personalTasks } = useAppStore();
  const currentUser = teamMembers.find(m => m.id === currentUserId);

  const myPersonalTotal = personalTasks.filter(t => t.ownerId === currentUserId).length;
  const myPersonalDone  = personalTasks.filter(t => t.ownerId === currentUserId && t.status === 'Concluído').length;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#f8f8f7]">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-8 pt-6 pb-0 shrink-0">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Meu Cronograma</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">{currentUser?.name ?? 'Usuário'}</p>
          </div>
          {currentUser && (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold text-white shadow-sm"
              style={{ backgroundColor: currentUser.color }}
            >
              {currentUser.avatar}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 -mb-px">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
              activeTab === 'tasks'
                ? 'border-[#1f6feb] text-[#1f6feb]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ListTodo size={14} />
            Minhas Tarefas
            {myPersonalTotal > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'tasks' ? 'bg-[#1f6feb]/10 text-[#1f6feb]' : 'bg-gray-100 text-gray-400'
              }`}>
                {myPersonalTotal - myPersonalDone > 0 ? myPersonalTotal - myPersonalDone : myPersonalTotal}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('agenda')}
            className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
              activeTab === 'agenda'
                ? 'border-[#1f6feb] text-[#1f6feb]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <CalendarDays size={14} />
            Agenda
          </button>
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === 'tasks' ? <MyTasksTab /> : <AgendaTab />}
      </div>
    </div>
  );
}
