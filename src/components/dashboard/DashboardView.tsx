import { Calendar, ChevronDown, ChevronRight, TrendingUp, X } from 'lucide-react';
import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, ResponsiveContainer,
} from 'recharts';
import { useAppStore } from '../../store/useAppStore';
import type { Company, Task, TeamMember } from '../../types';
import { ProgressBar } from '../shared/ProgressBar';
import { AvatarGroup } from '../shared/Avatar';

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-5 md:px-8 md:py-7 flex items-center gap-4 md:gap-5 min-w-0">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + '18' }}>
        <TrendingUp size={16} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-[11px] text-gray-400 mt-1.5 truncate">{label}</p>
        {sub && <p className="text-[10px] text-gray-300 mt-1 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

interface FilterBarProps {
  companies: Company[];
  teamMembers: TeamMember[];
  selectedCompanyIds: string[];
  selectedUserIds: string[];
  onToggleCompany: (id: string) => void;
  onToggleUser: (id: string) => void;
  onClearAll: () => void;
  filteredCount: number;
  totalCount: number;
  currentUserId: string | null;
  isAdminOrManager: boolean;
}

function FilterBar({
  companies, teamMembers,
  selectedCompanyIds, selectedUserIds,
  onToggleCompany, onToggleUser, onClearAll,
  filteredCount, totalCount,
  currentUserId, isAdminOrManager,
}: FilterBarProps) {
  const hasFilter = selectedCompanyIds.length > 0 || selectedUserIds.length > 0;
  const currentMember = teamMembers.find(m => m.id === currentUserId);

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-5 py-4 space-y-3">
      {/* Empresas row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider w-16 shrink-0">Empresas</span>
        <button
          onClick={() => selectedCompanyIds.length > 0 && onClearAll()}
          className="h-6 px-2.5 rounded-full text-[11px] font-semibold transition-all"
          style={selectedCompanyIds.length === 0
            ? { backgroundColor: '#FF5C35', color: '#fff' }
            : { backgroundColor: '#f3f4f6', color: '#9ca3af' }}
        >
          Todas
        </button>
        {companies.map(c => {
          const active = selectedCompanyIds.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => onToggleCompany(c.id)}
              className="h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-semibold transition-all"
              style={active
                ? { backgroundColor: c.color, color: '#fff' }
                : { backgroundColor: '#f3f4f6', color: '#6b7280' }}
            >
              <span
                className="w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[7px] font-bold shrink-0"
                style={{ backgroundColor: active ? 'rgba(255,255,255,0.25)' : c.color, color: '#fff' }}
              >
                {c.logo}
              </span>
              {c.name}
            </button>
          );
        })}
      </div>

      {/* Membros row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider w-16 shrink-0">Membros</span>

        {/* "Todos" — admins/managers only */}
        {isAdminOrManager && (
          <button
            onClick={() => selectedUserIds.length > 0 && onClearAll()}
            className="h-6 px-2.5 rounded-full text-[11px] font-semibold transition-all"
            style={selectedUserIds.length === 0
              ? { backgroundColor: '#FF5C35', color: '#fff' }
              : { backgroundColor: '#f3f4f6', color: '#9ca3af' }}
          >
            Todos
          </button>
        )}

        {/* "EU" chip — everyone */}
        {currentUserId && currentMember && (
          <button
            onClick={() => onToggleUser(currentUserId)}
            className="h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-semibold transition-all"
            style={selectedUserIds.includes(currentUserId)
              ? { backgroundColor: currentMember.color, color: '#fff' }
              : !isAdminOrManager && selectedUserIds.length === 0
                ? { backgroundColor: '#FF5C35', color: '#fff' }
                : { backgroundColor: '#f3f4f6', color: '#6b7280' }}
          >
            <span
              className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0"
              style={{
                backgroundColor: selectedUserIds.includes(currentUserId) || (!isAdminOrManager && selectedUserIds.length === 0)
                  ? 'rgba(255,255,255,0.3)' : currentMember.color,
                color: '#fff',
              }}
            >
              {currentMember.avatar}
            </span>
            EU
          </button>
        )}

        {/* All other member chips — admins/managers only */}
        {isAdminOrManager && teamMembers
          .filter(m => m.id !== currentUserId)
          .map(m => {
            const active = selectedUserIds.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => onToggleUser(m.id)}
                className="h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-semibold transition-all"
                style={active
                  ? { backgroundColor: m.color, color: '#fff' }
                  : { backgroundColor: '#f3f4f6', color: '#6b7280' }}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0"
                  style={{ backgroundColor: active ? 'rgba(255,255,255,0.3)' : m.color, color: '#fff' }}
                >
                  {m.avatar}
                </span>
                {m.name.split(' ')[0]}
              </button>
            );
          })}
      </div>

      {/* Active filter summary + clear */}
      {hasFilter && (
        <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
          <span className="text-[11px] text-gray-400">
            Mostrando <strong>{filteredCount}</strong> de <strong>{totalCount}</strong> tarefas
          </span>
          <button
            onClick={onClearAll}
            className="ml-auto flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-400 transition-colors"
          >
            <X size={11} />
            Limpar filtros
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Project group table ───────────────────────────────────────────────────────

function ProjectGroupTable({
  company,
  activeTasks,
  visibleProjectIds,
}: {
  company: Company;
  activeTasks: Task[];
  visibleProjectIds: Set<string>;
}) {
  const { projects, teamMembers, setActiveProject } = useAppStore();
  const [collapsed, setCollapsed] = useState(false);

  const companyProjects = projects
    .filter(p => p.companyId === company.id && visibleProjectIds.has(p.id));
  const today = new Date().toISOString().split('T')[0];

  if (!companyProjects.length) return null;

  return (
    <div className="mb-8">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center gap-3 mb-3 group w-full text-left"
      >
        {collapsed
          ? <ChevronRight size={13} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
          : <ChevronDown size={13} className="text-gray-300 group-hover:text-gray-500 transition-colors" />}
        <span className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: company.color }}>{company.logo}</span>
        <span className="font-semibold text-gray-800 text-[14px]">{company.name}</span>
        <span className="text-[12px] text-gray-400 font-normal">{company.industry}</span>
        <span className="text-[12px] text-gray-400 ml-1">{companyProjects.length}</span>
      </button>

      {!collapsed && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="grid text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 px-8 py-4 bg-gray-50/70 whitespace-nowrap"
              style={{ gridTemplateColumns: '240px 170px 180px 80px 140px 130px', minWidth: '940px' }}>
              <span>Projeto</span>
              <span>Progresso</span>
              <span>Tarefas</span>
              <span>Saúde</span>
              <span>Próximo prazo</span>
              <span>Equipe</span>
            </div>

            {companyProjects.map((project, i) => {
              const pt = activeTasks.filter(t => t.projectId === project.id);
              const done = pt.filter(t => t.status === 'Done').length;
              const inProg = pt.filter(t => t.status === 'In Progress').length;
              const blocked = pt.filter(t => t.status === 'Blocked').length;
              const overdue = pt.filter(t => t.dueDate < today && t.status !== 'Done').length;
              const health = pt.length ? Math.round((done / pt.length) * 100) : 0;
              const healthColor = health >= 70 ? '#22c55e' : health >= 40 ? '#f59e0b' : '#ef4444';
              const members = project.teamMemberIds.map(id => teamMembers.find(m => m.id === id)!).filter(Boolean);
              const nextTask = pt.filter(t => t.dueDate >= today && t.status !== 'Done').sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
              const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });

              return (
                <div
                  key={project.id}
                  onClick={() => setActiveProject(project.id)}
                  className={`grid items-center px-8 py-5 cursor-pointer hover:bg-gray-50 transition-colors group ${i > 0 ? 'border-t border-gray-100' : ''}`}
                  style={{ gridTemplateColumns: '240px 170px 180px 80px 140px 130px', minWidth: '940px' }}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-5">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0 mt-0.5" style={{ backgroundColor: project.color }} />
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-gray-800 truncate group-hover:text-[#FF5C35] transition-colors leading-snug">{project.name}</p>
                      <p className="text-[12px] text-gray-400 truncate mt-0.5">{project.description}</p>
                    </div>
                  </div>
                  <div className="pr-6">
                    <ProgressBar value={health} color={project.color} height="normal" showLabel={false} />
                    <p className="text-[10px] text-gray-400 mt-1.5">{done}/{pt.length} concluídas</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {inProg > 0 && <span className="text-[11px] px-2 py-1 rounded-full bg-blue-50 text-blue-600 font-semibold">{inProg} ativo{inProg > 1 ? 's' : ''}</span>}
                    {blocked > 0 && <span className="text-[11px] px-2 py-1 rounded-full bg-red-50 text-red-600 font-semibold">{blocked} bloqueada{blocked > 1 ? 's' : ''}</span>}
                    {overdue > 0 && <span className="text-[11px] px-2 py-1 rounded-full bg-amber-50 text-amber-600 font-semibold">{overdue} atrasada{overdue > 1 ? 's' : ''}</span>}
                    {!inProg && !blocked && !overdue && <span className="text-[12px] text-gray-400">{pt.length} tarefas</span>}
                  </div>
                  <div>
                    <span className="text-[13px] font-bold" style={{ color: healthColor }}>{health}%</span>
                  </div>
                  <div>
                    {nextTask ? (
                      <div className="flex items-center gap-1 text-[11px] text-gray-500">
                        <Calendar size={10} className="text-gray-400" />
                        <span>{fmtDate(nextTask.dueDate)}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-300">—</span>
                    )}
                  </div>
                  <div>
                    <AvatarGroup members={members} max={4} size="sm" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  'Não iniciado':  '#9ca3af',
  'Em andamento':  '#3b82f6',
  'Em revisão':    '#f59e0b',
  'Concluído':     '#22c55e',
  'Bloqueado':     '#ef4444',
};

const PRIORITY_COLORS: Record<string, string> = {
  'Baixa':   '#9ca3af',
  'Média':   '#3b82f6',
  'Alta':    '#f97316',
  'Urgente': '#ef4444',
};

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-7 py-6">
      <div className="mb-5">
        <p className="text-[13px] font-bold text-gray-800">{title}</p>
        {subtitle && <p className="text-[11px] text-gray-400 mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 shadow-lg text-[12px]">
      {label && <p className="font-semibold text-gray-700 mb-1">{label}</p>}
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color ?? p.fill }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-semibold text-gray-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function ChartsSection({
  filteredTasks,
  filteredProjects,
  teamMembers,
}: {
  filteredTasks: Task[];
  filteredProjects: { id: string; name: string; color: string }[];
  teamMembers: TeamMember[];
}) {
  const [projectView, setProjectView] = useState<'status' | 'progress'>('status');

  const statusData = [
    { name: 'Não iniciado', value: filteredTasks.filter(t => t.status === 'Not Started').length },
    { name: 'Em andamento', value: filteredTasks.filter(t => t.status === 'In Progress').length },
    { name: 'Em revisão',   value: filteredTasks.filter(t => t.status === 'Review').length },
    { name: 'Concluído',    value: filteredTasks.filter(t => t.status === 'Done').length },
    { name: 'Bloqueado',    value: filteredTasks.filter(t => t.status === 'Blocked').length },
  ].filter(d => d.value > 0);

  const priorityData = [
    { name: 'Baixa',   value: filteredTasks.filter(t => t.priority === 'Low').length },
    { name: 'Média',   value: filteredTasks.filter(t => t.priority === 'Medium').length },
    { name: 'Alta',    value: filteredTasks.filter(t => t.priority === 'High').length },
    { name: 'Urgente', value: filteredTasks.filter(t => t.priority === 'Urgent').length },
  ].filter(d => d.value > 0);

  const projectStatusData = filteredProjects.map(p => {
    const pt = filteredTasks.filter(t => t.projectId === p.id && !t.parentTaskId);
    const label = p.name.length > 14 ? p.name.slice(0, 14) + '…' : p.name;
    return {
      name: label,
      'Não iniciado': pt.filter(t => t.status === 'Not Started').length,
      'Em andamento': pt.filter(t => t.status === 'In Progress').length,
      'Em revisão':   pt.filter(t => t.status === 'Review').length,
      'Concluído':    pt.filter(t => t.status === 'Done').length,
      'Bloqueado':    pt.filter(t => t.status === 'Blocked').length,
    };
  });

  const projectProgressData = filteredProjects.map(p => {
    const pt = filteredTasks.filter(t => t.projectId === p.id && !t.parentTaskId);
    const done = pt.filter(t => t.status === 'Done').length;
    const pct = pt.length ? Math.round((done / pt.length) * 100) : 0;
    return {
      name: p.name.length > 14 ? p.name.slice(0, 14) + '…' : p.name,
      Progresso: pct,
      fill: p.color,
    };
  }).sort((a, b) => b.Progresso - a.Progresso);

  // Per-user status (top-level tasks only)
  const topLevel = filteredTasks.filter(t => !t.parentTaskId);
  const userRows = teamMembers
    .map(m => {
      const mt = topLevel.filter(t => t.assigneeId === m.id);
      return {
        name: m.name.length > 18 ? m.name.slice(0, 18) + '…' : m.name,
        'Não iniciado': mt.filter(t => t.status === 'Not Started').length,
        'Em andamento': mt.filter(t => t.status === 'In Progress').length,
        'Em revisão':   mt.filter(t => t.status === 'Review').length,
        'Concluído':    mt.filter(t => t.status === 'Done').length,
        'Bloqueado':    mt.filter(t => t.status === 'Blocked').length,
        _total: mt.length,
      };
    })
    .filter(r => r._total > 0)
    .sort((a, b) => b._total - a._total);

  const unassigned = topLevel.filter(t => !t.assigneeId);
  if (unassigned.length > 0) {
    userRows.push({
      name: 'Sem responsável',
      'Não iniciado': unassigned.filter(t => t.status === 'Not Started').length,
      'Em andamento': unassigned.filter(t => t.status === 'In Progress').length,
      'Em revisão':   unassigned.filter(t => t.status === 'Review').length,
      'Concluído':    unassigned.filter(t => t.status === 'Done').length,
      'Bloqueado':    unassigned.filter(t => t.status === 'Blocked').length,
      _total: unassigned.length,
    });
  }

  const userChartHeight = Math.max(160, userRows.length * 44);
  const projChartHeight = Math.max(160, filteredProjects.length * 44);

  return (
    <div className="space-y-4">
      {/* Row 1: status donut + priority bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Tarefas por Status" subtitle="Visão geral">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="45%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {statusData.map(entry => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#9ca3af'} stroke="none" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#6b7280' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Tarefas por Prioridade" subtitle="Distribuição de prioridade">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={priorityData} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
              <Bar dataKey="value" name="Tarefas" radius={[6, 6, 0, 0]}>
                {priorityData.map(entry => (
                  <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] ?? '#9ca3af'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 2: per-project */}
      <ChartCard
        title="Visão por Projeto"
        subtitle={projectView === 'status' ? 'Tarefas por status em cada projeto' : '% de conclusão por projeto'}
      >
        <div className="flex gap-1 mb-6 mt-1">
          {(['status', 'progress'] as const).map(v => (
            <button key={v} onClick={() => setProjectView(v)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${projectView === v ? 'text-white' : 'text-gray-400 hover:text-gray-600 bg-gray-50'}`}
              style={projectView === v ? { backgroundColor: '#FF5C35' } : {}}>
              {v === 'status' ? 'Por status' : 'Progresso'}
            </button>
          ))}
        </div>
        {projectView === 'status' ? (
          <ResponsiveContainer width="100%" height={projChartHeight}>
            <BarChart data={projectStatusData} barSize={20} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#6b7280' }}>{v}</span>} />
              {Object.keys(STATUS_COLORS).map(status => (
                <Bar key={status} dataKey={status} stackId="a" fill={STATUS_COLORS[status]} radius={status === 'Bloqueado' ? [0, 4, 4, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={projChartHeight}>
            <BarChart data={projectProgressData} layout="vertical" barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} formatter={(v) => [`${Number(v)}%`, 'Progresso']} />
              <Bar dataKey="Progresso" radius={[0, 6, 6, 0]}>
                {projectProgressData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Row 3: per-user */}
      <ChartCard title="Visão por Usuário" subtitle="Tarefas por status atribuídas a cada membro">
        {userRows.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[13px] text-gray-300">
            Nenhuma tarefa atribuída nos projetos selecionados
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={userChartHeight}>
            <BarChart data={userRows} barSize={20} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#6b7280' }}>{v}</span>} />
              {Object.keys(STATUS_COLORS).map(status => (
                <Bar key={status} dataKey={status} stackId="a" fill={STATUS_COLORS[status]} radius={status === 'Bloqueado' ? [0, 4, 4, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function DashboardView() {
  const { tasks, projects, companies, teamMembers, currentUserId } = useAppStore();
  const currentUser = teamMembers.find(m => m.id === currentUserId);
  const isAdminOrManager = currentUser?.permission === 'Admin' || currentUser?.permission === 'Gerente';

  // ── Filter state ──────────────────────────────────────────────────────────
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds]       = useState<string[]>([]);

  const toggleCompany = (id: string) =>
    setSelectedCompanyIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  const toggleUser = (id: string) =>
    setSelectedUserIds(prev => prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]);
  const clearAll = () => { setSelectedCompanyIds([]); setSelectedUserIds([]); };

  // ── Derived filtered data ─────────────────────────────────────────────────
  const activeCompanyIds = selectedCompanyIds.length > 0
    ? selectedCompanyIds : companies.map(c => c.id);

  const filteredProjects = projects.filter(p => activeCompanyIds.includes(p.companyId));
  const filteredProjectIds = new Set(filteredProjects.map(p => p.id));

  const tasksInScope = tasks.filter(t => filteredProjectIds.has(t.projectId));
  const filteredTasks = selectedUserIds.length > 0
    ? tasksInScope.filter(t => selectedUserIds.includes(t.assigneeId ?? ''))
    : tasksInScope;

  // Projects that have at least one task in the filtered set (for project table)
  const visibleProjectIds = new Set(filteredTasks.map(t => t.projectId));
  // Fallback: if user filter gives 0 visible projects, still show all in-scope projects
  const tableProjectIds = visibleProjectIds.size > 0 ? visibleProjectIds : filteredProjectIds;
  const visibleCompanies = companies.filter(c =>
    [...tableProjectIds].some(pid => {
      const p = projects.find(pp => pp.id === pid);
      return p?.companyId === c.id;
    })
  );

  // ── Stats ─────────────────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const done    = filteredTasks.filter(t => t.status === 'Done').length;
  const inProg  = filteredTasks.filter(t => t.status === 'In Progress').length;
  const blocked = filteredTasks.filter(t => t.status === 'Blocked').length;
  const overdue = filteredTasks.filter(t => t.dueDate < today && t.status !== 'Done').length;

  const dayOfWeek = new Date().toLocaleDateString('pt-BR', { weekday: 'long' });
  const dateStr   = new Date().toLocaleDateString('pt-BR', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="flex-1 overflow-auto bg-[#F5F6F8]">
      <div className="px-4 py-6 md:px-10 lg:px-14 md:py-10 lg:py-12 space-y-6 md:space-y-10">

        {/* Welcome */}
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">
            {new Date().getHours() < 12 ? 'Bom dia' : 'Boa tarde'} 👋
          </h1>
          <p className="text-sm text-gray-400 mt-2">{dayOfWeek}, {dateStr}</p>
        </div>

        {/* Filter bar */}
        <FilterBar
          companies={companies}
          teamMembers={teamMembers}
          selectedCompanyIds={selectedCompanyIds}
          selectedUserIds={selectedUserIds}
          onToggleCompany={toggleCompany}
          onToggleUser={toggleUser}
          onClearAll={clearAll}
          filteredCount={filteredTasks.length}
          totalCount={tasks.length}
          currentUserId={currentUserId}
          isAdminOrManager={isAdminOrManager}
        />

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          <StatCard label="Total de tarefas" value={filteredTasks.length} color="#6366f1" />
          <StatCard
            label="Concluídas"
            value={done}
            sub={filteredTasks.length ? `${Math.round((done / filteredTasks.length) * 100)}% do total` : undefined}
            color="#22c55e"
          />
          <StatCard label="Em andamento" value={inProg} color="#3b82f6" />
          <StatCard
            label="Precisam de atenção"
            value={blocked + overdue}
            sub={`${blocked} bloqueadas · ${overdue} atrasadas`}
            color="#ef4444"
          />
        </div>

        {/* Charts */}
        <div>
          <h2 className="font-semibold text-[14px] text-gray-700 mb-4">Gráficos</h2>
          <ChartsSection
            filteredTasks={filteredTasks}
            filteredProjects={filteredProjects}
            teamMembers={teamMembers}
          />
        </div>

        {/* Projects table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[14px] text-gray-700">Todos os Projetos</h2>
            <span className="text-[11px] text-gray-400">
              {[...tableProjectIds].length} projetos em {visibleCompanies.length} empresas
            </span>
          </div>
          {visibleCompanies.map(c => (
            <ProjectGroupTable
              key={c.id}
              company={c}
              activeTasks={filteredTasks}
              visibleProjectIds={tableProjectIds}
            />
          ))}
        </div>

      </div>
    </div>
  );
}
