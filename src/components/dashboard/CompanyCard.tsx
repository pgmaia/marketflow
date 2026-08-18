import { ArrowRight, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import type { Company } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { ProgressBar } from '../shared/ProgressBar';
import { localISO } from '../../lib/date';

interface CompanyCardProps {
  company: Company;
}

export function CompanyCard({ company }: CompanyCardProps) {
  const { projects, tasks, setActiveCompany } = useAppStore();

  const companyProjects = projects.filter(p => p.companyId === company.id);
  const projectIds = companyProjects.map(p => p.id);
  const allTasks = tasks.filter(t => projectIds.includes(t.projectId));

  const done = allTasks.filter(t => t.status === 'Concluído').length;
  const blocked = allTasks.filter(t => t.status === 'Bloqueado').length;
  const inProgress = allTasks.filter(t => t.status === 'Em andamento').length;
  const health = allTasks.length ? Math.round((done / allTasks.length) * 100) : 0;

  const today = localISO();
  const overdue = allTasks.filter(t => t.dueDate < today && t.status !== 'Concluído').length;

  const upcoming = allTasks
    .filter(t => t.dueDate >= today && t.status !== 'Concluído')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const nextDeadline = upcoming[0]?.dueDate;

  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
  };

  const healthColor = health >= 70 ? '#22c55e' : health >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 p-5 cursor-pointer hover:border-gray-200 hover:shadow-md transition-all group"
      onClick={() => setActiveCompany(company.id)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
            style={{ backgroundColor: company.color }}
          >
            {company.logo}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm leading-tight">{company.name}</h3>
            <p className="text-xs text-gray-400">{company.industry}</p>
          </div>
        </div>
        <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all mt-1" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-gray-50 rounded-xl p-2.5">
          <p className="text-[11px] text-gray-400 mb-0.5">Projetos</p>
          <p className="text-lg font-bold text-gray-900">{companyProjects.length}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2.5">
          <p className="text-[11px] text-gray-400 mb-0.5">Tarefas</p>
          <p className="text-lg font-bold text-gray-900">{allTasks.length}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2.5">
          <p className="text-[11px] text-gray-400 mb-0.5">Saúde</p>
          <p className="text-lg font-bold" style={{ color: healthColor }}>{health}%</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-gray-400">Progresso geral</span>
          <span className="text-[11px] font-medium text-gray-600">{done}/{allTasks.length} concluídas</span>
        </div>
        <ProgressBar value={health} color={company.color} />
      </div>

      {/* Indicators */}
      <div className="flex items-center gap-3 text-[11px]">
        {overdue > 0 && (
          <div className="flex items-center gap-1 text-red-500">
            <AlertCircle size={11} />
            <span>{overdue} atrasada{overdue > 1 ? 's' : ''}</span>
          </div>
        )}
        {blocked > 0 && (
          <div className="flex items-center gap-1 text-amber-500">
            <AlertCircle size={11} />
            <span>{blocked} bloqueada{blocked > 1 ? 's' : ''}</span>
          </div>
        )}
        {inProgress > 0 && (
          <div className="flex items-center gap-1 text-blue-500">
            <Clock size={11} />
            <span>{inProgress} ativo{inProgress > 1 ? 's' : ''}</span>
          </div>
        )}
        {nextDeadline && (
          <div className="flex items-center gap-1 text-gray-400 ml-auto">
            <CheckCircle2 size={11} />
            <span>Próximo: {formatDate(nextDeadline)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
