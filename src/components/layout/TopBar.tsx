import { Bell, Plus, SlidersHorizontal, Sun, Moon, Menu } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { TaskStatus } from '../../types';

const statusOptions: { value: TaskStatus | 'All'; label: string }[] = [
  { value: 'All',          label: 'Todos'         },
  { value: 'Backlog',      label: 'Backlog'        },
  { value: 'Sprint',       label: 'Sprint'         },
  { value: 'Em andamento', label: 'Em andamento'   },
  { value: 'Em revisão',   label: 'Em revisão'     },
  { value: 'Bloqueado',    label: 'Bloqueado'      },
  { value: 'Concluído',    label: 'Concluído'      },
];

interface TopBarProps {
  onNewTask?: () => void;
  onMenuToggle?: () => void;
}

export function TopBar({ onNewTask, onMenuToggle }: TopBarProps) {
  const { view, filters, setFilters, darkMode, toggleDarkMode } = useAppStore();

  return (
    <div className="h-14 shrink-0 bg-white border-b border-gray-100 sticky top-0 z-10">
      <div className="px-4 md:px-14 h-full flex items-center justify-between gap-2">

        {/* Left: hamburger (mobile) + page title */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onMenuToggle}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors shrink-0"
          >
            <Menu size={18} />
          </button>
          <span className="text-[13px] font-semibold text-gray-700 truncate">
            {view === 'dashboard' && 'Início'}
            {view === 'company'   && 'Empresa'}
            {view === 'users'     && 'Usuários'}
            {view === 'trash'     && 'Lixeira'}
            {view === 'schedule'  && 'Meu Cronograma'}
            {view === 'backup'    && 'Backup & Recuperação'}
          </span>
        </div>

        {/* Right: filters (hidden on small screens) + actions */}
        <div className="flex items-center gap-2">
          {/* Filters — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-2">
            <SlidersHorizontal size={12} className="text-gray-400" />
            <select
              value={filters.status ?? 'All'}
              onChange={e => setFilters({ status: e.target.value === 'All' ? null : e.target.value as TaskStatus })}
              className="h-7 px-2.5 bg-gray-50 border border-gray-200 rounded-md text-[12px] text-gray-600 outline-none cursor-pointer hover:border-gray-300 transition-colors"
            >
              {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select
              value={filters.dueDateRange}
              onChange={e => setFilters({ dueDateRange: e.target.value as any })}
              className="h-7 px-2.5 bg-gray-50 border border-gray-200 rounded-md text-[12px] text-gray-600 outline-none cursor-pointer hover:border-gray-300 transition-colors"
            >
              <option value="all">Todas as datas</option>
              <option value="overdue">Atrasadas</option>
              <option value="this-week">Esta semana</option>
              <option value="this-month">Este mês</option>
            </select>
          </div>

          <div className="hidden sm:block w-px h-4 bg-gray-200 mx-1" />

          {onNewTask && (
            <button
              onClick={onNewTask}
              className="h-7 flex items-center gap-1.5 px-2.5 sm:px-3 rounded-md text-[12px] font-semibold text-white"
              style={{ backgroundColor: '#1f6feb' }}
            >
              <Plus size={13} />
              <span className="hidden sm:inline">Nova tarefa</span>
            </button>
          )}

          <button
            onClick={toggleDarkMode}
            title={darkMode ? 'Modo claro' : 'Modo escuro'}
            className="w-8 h-8 rounded-md hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors shrink-0"
          >
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          <button className="w-8 h-8 rounded-md hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors shrink-0">
            <Bell size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
