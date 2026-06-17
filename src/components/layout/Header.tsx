import { Search, SlidersHorizontal } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { TaskStatus } from '../../types';

const statusOptions: (TaskStatus | 'All')[] = ['All', 'Backlog', 'Sprint', 'Em andamento', 'Em revisão', 'Bloqueado', 'Concluído'];

export function Header() {
  const { view, activeCompanyId, activeProjectId, companies, projects, filters, setFilters } = useAppStore();

  const company = companies.find(c => c.id === activeCompanyId);
  const project = projects.find(p => p.id === activeProjectId);

  const breadcrumb = () => {
    if (view === 'dashboard') return 'Dashboard';
    if (view === 'company' && company) return company.name;
    if (view === 'project' && project) return project.name;
    return '';
  };

  const subtitle = () => {
    if (view === 'company' && company) return company.industry;
    if (view === 'project' && project) return projects.find(p => p.id === activeProjectId)?.description ?? '';
    return 'All companies & projects at a glance';
  };

  return (
    <header className="sticky top-0 z-20 bg-[#F4F4F6]/90 backdrop-blur-sm border-b border-gray-200/70 px-6 py-3">
      <div className="flex items-center justify-between gap-4">
        {/* Breadcrumb */}
        <div>
          <h1 className="font-display text-xl font-bold text-gray-900 leading-tight">{breadcrumb()}</h1>
          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-sm">{subtitle()}</p>
        </div>

        {/* Filters + Search */}
        <div className="flex items-center gap-2">
          {/* Status filter */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5">
            <SlidersHorizontal size={13} className="text-gray-400" />
            <select
              className="text-xs text-gray-600 bg-transparent border-none outline-none cursor-pointer"
              value={filters.status ?? 'All'}
              onChange={(e) => setFilters({ status: e.target.value === 'All' ? null : e.target.value as TaskStatus })}
            >
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Due date filter */}
          <select
            className="text-xs text-gray-600 bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none cursor-pointer"
            value={filters.dueDateRange}
            onChange={(e) => setFilters({ dueDateRange: e.target.value as any })}
          >
            <option value="all">All dates</option>
            <option value="overdue">Overdue</option>
            <option value="this-week">This week</option>
            <option value="this-month">This month</option>
          </select>

          {/* Search placeholder */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
            <Search size={13} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              className="text-xs text-gray-600 bg-transparent border-none outline-none w-28 placeholder-gray-300"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
