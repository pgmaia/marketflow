import { CheckCircle2, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export function StatsBar() {
  const { tasks, projects, filters } = useAppStore();

  const filtered = tasks.filter(t => {
    if (filters.status && t.status !== filters.status) return false;
    if (filters.companyId) {
      const proj = projects.find(p => p.id === t.projectId);
      if (!proj || proj.companyId !== filters.companyId) return false;
    }
    return true;
  });

  const today = new Date().toISOString().split('T')[0];
  const done = filtered.filter(t => t.status === 'Done').length;
  const inProgress = filtered.filter(t => t.status === 'In Progress').length;
  const blocked = filtered.filter(t => t.status === 'Blocked').length;
  const overdue = filtered.filter(t => t.dueDate < today && t.status !== 'Done').length;

  const stats = [
    { label: 'Total Tasks', value: filtered.length, icon: TrendingUp, color: 'text-gray-600', bg: 'bg-gray-50' },
    { label: 'Done', value: done, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'In Progress', value: inProgress, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Blocked', value: blocked, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Overdue', value: overdue, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="grid grid-cols-5 gap-3">
      {stats.map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className={`${bg} rounded-xl px-4 py-3 flex items-center gap-3`}>
          <Icon size={16} className={color} />
          <div>
            <p className="text-xs text-gray-400">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
