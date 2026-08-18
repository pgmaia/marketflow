import { Calendar, CalendarDays, Check, ChevronDown, ChevronRight, LayoutList, TrendingUp, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, ResponsiveContainer,
} from 'recharts';
import { useAppStore } from '../../store/useAppStore';
import type { Company, Task, Team, TeamMember } from '../../types';
import { DashboardCalendar } from './DashboardCalendar';
import { getAssigneeIds } from '../../types';
import { ProgressBar } from '../shared/ProgressBar';
import { AvatarGroup } from '../shared/Avatar';
import { localISO } from '../../lib/date';

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

function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return { open, setOpen, ref };
}

interface FilterDropdownProps {
  label: string;
  selectedCount: number;
  selectedLabel?: string; // shown when exactly 1 item selected
  onClear: () => void;
  children: React.ReactNode;
}

function FilterDropdown({ label, selectedCount, selectedLabel, onClear, children }: FilterDropdownProps) {
  const { open, setOpen, ref } = useDropdown();
  const isActive = selectedCount > 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold border transition-all ${
          isActive
            ? 'bg-[#1f6feb] text-white border-[#1f6feb]'
            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-800'
        }`}
      >
        <span>{label}</span>
        {isActive && (
          <span className="bg-white/25 text-white text-[10px] font-bold rounded-full px-1.5 py-px leading-none">
            {selectedCount === 1 && selectedLabel ? selectedLabel : selectedCount}
          </span>
        )}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''} ${isActive ? 'text-white/70' : 'text-gray-400'}`} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1.5 bg-white rounded-xl border border-gray-100 shadow-xl z-50 overflow-hidden"
          style={{ minWidth: 200, maxHeight: 320, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface FilterBarProps {
  companies: Company[];
  teams: Team[];
  teamMembers: TeamMember[];
  selectedCompanyIds: string[];
  selectedTeamIds: string[];
  selectedUserIds: string[];
  onToggleCompany: (id: string) => void;
  onToggleTeam: (id: string) => void;
  onToggleUser: (id: string) => void;
  onClearCompanies: () => void;
  onClearTeams: () => void;
  onClearMembers: () => void;
  onClearAll: () => void;
  filteredCount: number;
  totalCount: number;
  currentUserId: string | null;
  isAdminOrManager: boolean;
}

function FilterBar({
  companies, teams, teamMembers,
  selectedCompanyIds, selectedTeamIds, selectedUserIds,
  onToggleCompany, onToggleTeam, onToggleUser,
  onClearCompanies, onClearTeams, onClearMembers, onClearAll,
  filteredCount, totalCount,
  currentUserId, isAdminOrManager,
}: FilterBarProps) {
  const hasFilter = selectedCompanyIds.length > 0 || selectedTeamIds.length > 0 || selectedUserIds.length > 0;
  const currentMember = teamMembers.find(m => m.id === currentUserId);

  const selectedCompanyName = selectedCompanyIds.length === 1
    ? companies.find(c => c.id === selectedCompanyIds[0])?.name : undefined;
  const selectedTeamName = selectedTeamIds.length === 1
    ? teams.find(t => t.id === selectedTeamIds[0])?.name : undefined;
  const selectedMemberName = selectedUserIds.length === 1
    ? (selectedUserIds[0] === currentUserId ? 'EU' : teamMembers.find(m => m.id === selectedUserIds[0])?.name.split(' ')[0])
    : undefined;

  // Shared "Todas/Todos" row style
  const allRowClass = (active: boolean) =>
    `w-full flex items-center gap-2.5 px-3 py-2.5 transition-colors border-b border-gray-50 ${active ? 'bg-orange-50/60' : 'hover:bg-gray-50'}`;

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-5 py-3.5 flex items-center gap-2 flex-wrap">

      {/* ── Tudo ── */}
      <button
        onClick={onClearAll}
        className={`h-8 px-3 rounded-lg text-[12px] font-semibold border transition-all ${
          !hasFilter
            ? 'bg-[#1f6feb] text-white border-[#1f6feb]'
            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
        }`}
      >
        Tudo
      </button>

      <div className="w-px h-5 bg-gray-200 mx-0.5" />

      {/* ── Empresa ── */}
      <FilterDropdown
        label="Empresa"
        selectedCount={selectedCompanyIds.length}
        selectedLabel={selectedCompanyName}
        onClear={onClearCompanies}
      >
        {/* Todas */}
        <button onClick={onClearCompanies} className={allRowClass(selectedCompanyIds.length === 0)}>
          <span className="w-5 h-5 rounded-md bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-500 shrink-0">✦</span>
          <span className={`flex-1 text-left text-[13px] ${selectedCompanyIds.length === 0 ? 'font-semibold text-[#1f6feb]' : 'text-gray-700'}`}>Todas</span>
          {selectedCompanyIds.length === 0 && <Check size={13} className="text-[#1f6feb] shrink-0" />}
        </button>
        {companies.map(c => {
          const active = selectedCompanyIds.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => onToggleCompany(c.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors"
            >
              <span
                className="w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                style={{ backgroundColor: c.color }}
              >
                {c.logo}
              </span>
              <span className={`flex-1 text-left text-[13px] ${active ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                {c.name}
              </span>
              {active && <Check size={13} className="text-[#1f6feb] shrink-0" />}
            </button>
          );
        })}
      </FilterDropdown>

      {/* ── Equipe ── */}
      {teams.length > 0 && (
        <FilterDropdown
          label="Equipe"
          selectedCount={selectedTeamIds.length}
          selectedLabel={selectedTeamName}
          onClear={onClearTeams}
        >
          {/* Todas */}
          <button onClick={onClearTeams} className={allRowClass(selectedTeamIds.length === 0)}>
            <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
            <span className={`flex-1 text-left text-[13px] ${selectedTeamIds.length === 0 ? 'font-semibold text-[#1f6feb]' : 'text-gray-700'}`}>Todas</span>
            {selectedTeamIds.length === 0 && <Check size={13} className="text-[#1f6feb] shrink-0" />}
          </button>
          {teams.map(t => {
            const active = selectedTeamIds.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => onToggleTeam(t.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                <span className={`flex-1 text-left text-[13px] ${active ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                  {t.name}
                </span>
                <span className="text-[11px] text-gray-400 shrink-0">{t.memberIds.length}</span>
                {active && <Check size={13} className="text-[#1f6feb] shrink-0" />}
              </button>
            );
          })}
        </FilterDropdown>
      )}

      {/* ── Membro ── */}
      <FilterDropdown
        label="Membro"
        selectedCount={selectedUserIds.length}
        selectedLabel={selectedMemberName}
        onClear={onClearMembers}
      >
        {/* Todos */}
        <button onClick={onClearMembers} className={allRowClass(selectedUserIds.length === 0)}>
          <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-500 shrink-0">✦</span>
          <span className={`flex-1 text-left text-[13px] ${selectedUserIds.length === 0 ? 'font-semibold text-[#1f6feb]' : 'text-gray-700'}`}>Todos</span>
          {selectedUserIds.length === 0 && <Check size={13} className="text-[#1f6feb] shrink-0" />}
        </button>
        {/* EU */}
        {currentUserId && currentMember && (
          <button
            onClick={() => onToggleUser(currentUserId)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50"
          >
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
              style={{ backgroundColor: currentMember.color }}
            >
              {currentMember.avatar}
            </span>
            <span className={`flex-1 text-left text-[13px] ${selectedUserIds.includes(currentUserId) ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
              EU ({currentMember.name.split(' ')[0]})
            </span>
            {selectedUserIds.includes(currentUserId) && <Check size={13} className="text-[#1f6feb] shrink-0" />}
          </button>
        )}
        {/* Other members — admins/managers only */}
        {isAdminOrManager && teamMembers
          .filter(m => m.id !== currentUserId)
          .map(m => {
            const active = selectedUserIds.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => onToggleUser(m.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                  style={{ backgroundColor: m.color }}
                >
                  {m.avatar}
                </span>
                <span className={`flex-1 text-left text-[13px] ${active ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                  {m.name}
                </span>
                {active && <Check size={13} className="text-[#1f6feb] shrink-0" />}
              </button>
            );
          })}
      </FilterDropdown>

      {/* ── Task count ── */}
      {hasFilter && (
        <span className="text-[11px] text-gray-400 ml-1">
          <strong className="text-gray-700">{filteredCount}</strong>/{totalCount} tarefas
        </span>
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
  const today = localISO();

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
              const done = pt.filter(t => t.status === 'Concluído').length;
              const inProg = pt.filter(t => t.status === 'Em andamento').length;
              const blocked = pt.filter(t => t.status === 'Bloqueado').length;
              const overdue = pt.filter(t => t.dueDate < today && t.status !== 'Concluído').length;
              const health = pt.length ? Math.round((done / pt.length) * 100) : 0;
              const healthColor = health >= 70 ? '#22c55e' : health >= 40 ? '#f59e0b' : '#ef4444';
              const members = project.teamMemberIds.map(id => teamMembers.find(m => m.id === id)!).filter(Boolean);
              const nextTask = pt.filter(t => t.dueDate >= today && t.status !== 'Concluído').sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
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
                      <p className="text-[14px] font-semibold text-gray-800 truncate group-hover:text-[#1f6feb] transition-colors leading-snug">{project.name}</p>
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
  'Backlog':      '#9ca3af',
  'Sprint':       '#8b5cf6',
  'Em andamento': '#3b82f6',
  'Em revisão':   '#f59e0b',
  'Bloqueado':    '#ef4444',
  'Concluído':    '#22c55e',
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
    { name: 'Backlog',      value: filteredTasks.filter(t => t.status === 'Backlog').length },
    { name: 'Sprint',       value: filteredTasks.filter(t => t.status === 'Sprint').length },
    { name: 'Em andamento', value: filteredTasks.filter(t => t.status === 'Em andamento').length },
    { name: 'Em revisão',   value: filteredTasks.filter(t => t.status === 'Em revisão').length },
    { name: 'Bloqueado',    value: filteredTasks.filter(t => t.status === 'Bloqueado').length },
    { name: 'Concluído',    value: filteredTasks.filter(t => t.status === 'Concluído').length },
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
      'Backlog':      pt.filter(t => t.status === 'Backlog').length,
      'Sprint':       pt.filter(t => t.status === 'Sprint').length,
      'Em andamento': pt.filter(t => t.status === 'Em andamento').length,
      'Em revisão':   pt.filter(t => t.status === 'Em revisão').length,
      'Bloqueado':    pt.filter(t => t.status === 'Bloqueado').length,
      'Concluído':    pt.filter(t => t.status === 'Concluído').length,
    };
  });

  const projectProgressData = filteredProjects.map(p => {
    const pt = filteredTasks.filter(t => t.projectId === p.id && !t.parentTaskId);
    const done = pt.filter(t => t.status === 'Concluído').length;
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
      const mt = topLevel.filter(t => getAssigneeIds(t).includes(m.id));
      return {
        name: m.name.length > 18 ? m.name.slice(0, 18) + '…' : m.name,
        'Backlog':      mt.filter(t => t.status === 'Backlog').length,
        'Sprint':       mt.filter(t => t.status === 'Sprint').length,
        'Em andamento': mt.filter(t => t.status === 'Em andamento').length,
        'Em revisão':   mt.filter(t => t.status === 'Em revisão').length,
        'Bloqueado':    mt.filter(t => t.status === 'Bloqueado').length,
        'Concluído':    mt.filter(t => t.status === 'Concluído').length,
        _total: mt.length,
      };
    })
    .filter(r => r._total > 0)
    .sort((a, b) => b._total - a._total);

  const unassigned = topLevel.filter(t => getAssigneeIds(t).length === 0);
  if (unassigned.length > 0) {
    userRows.push({
      name: 'Sem responsável',
      'Backlog':      unassigned.filter(t => t.status === 'Backlog').length,
      'Sprint':       unassigned.filter(t => t.status === 'Sprint').length,
      'Em andamento': unassigned.filter(t => t.status === 'Em andamento').length,
      'Em revisão':   unassigned.filter(t => t.status === 'Em revisão').length,
      'Bloqueado':    unassigned.filter(t => t.status === 'Bloqueado').length,
      'Concluído':    unassigned.filter(t => t.status === 'Concluído').length,
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
              style={projectView === v ? { backgroundColor: '#1f6feb' } : {}}>
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
  const { tasks, projects, companies, teams, teamMembers, currentUserId, memberCompanyAccess, memberAccess, filters } = useAppStore();
  const currentUser = teamMembers.find(m => m.id === currentUserId);
  const isAdmin = currentUser?.permission === 'Admin';
  const isAdminOrManager = currentUser?.permission === 'Admin' || currentUser?.permission === 'Gerente';

  // ── Access control ────────────────────────────────────────────────────────
  const accessCompanyIds = isAdmin
    ? companies.map(c => c.id)
    : (memberCompanyAccess[currentUserId ?? ''] ?? companies.map(c => c.id));
  const accessProjectIds = isAdmin
    ? projects.map(p => p.id)
    : (memberAccess[currentUserId ?? ''] ?? projects.map(p => p.id));

  const accessibleCompanies = companies.filter(c => accessCompanyIds.includes(c.id));
  const accessibleProjects  = projects.filter(p =>
    accessProjectIds.includes(p.id) && accessCompanyIds.includes(p.companyId)
  );

  // ── View mode ─────────────────────────────────────────────────────────────
  const [dashView, setDashView] = useState<'overview' | 'calendar'>('overview');

  // ── Filter state ──────────────────────────────────────────────────────────
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [selectedTeamIds, setSelectedTeamIds]       = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds]       = useState<string[]>([]);

  const toggleCompany = (id: string) =>
    setSelectedCompanyIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  const toggleTeam = (id: string) =>
    setSelectedTeamIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  const toggleUser = (id: string) =>
    setSelectedUserIds(prev => prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]);
  const clearCompanies = () => setSelectedCompanyIds([]);
  const clearTeams     = () => setSelectedTeamIds([]);
  const clearMembers   = () => setSelectedUserIds([]);
  const clearAll = () => { setSelectedCompanyIds([]); setSelectedTeamIds([]); setSelectedUserIds([]); };

  // ── Derived filtered data ─────────────────────────────────────────────────
  const activeCompanyIds = selectedCompanyIds.length > 0
    ? selectedCompanyIds : accessCompanyIds;

  const filteredProjects = accessibleProjects.filter(p => activeCompanyIds.includes(p.companyId));
  const filteredProjectIds = new Set(filteredProjects.map(p => p.id));

  const tasksInScope = tasks.filter(t => filteredProjectIds.has(t.projectId));

  // Combine team + member filters: team expands to its member IDs, then intersect with explicit user selection
  const teamMemberIdsFromFilter = selectedTeamIds.length > 0
    ? [...new Set(teams.filter(t => selectedTeamIds.includes(t.id)).flatMap(t => t.memberIds))]
    : [];
  const effectiveUserIds =
    selectedTeamIds.length > 0 && selectedUserIds.length > 0
      ? selectedUserIds.filter(id => teamMemberIdsFromFilter.includes(id))
      : selectedTeamIds.length > 0
        ? teamMemberIdsFromFilter
        : selectedUserIds;

  const userFilteredTasks = effectiveUserIds.length > 0
    ? tasksInScope.filter(t => getAssigneeIds(t).some(id => effectiveUserIds.includes(id)))
    : tasksInScope;

  // Status and due-date pickers from the top bar. Nothing in the app read these
  // before, so changing them looked like the screen had frozen.
  const todayStr = localISO();
  const inDueRange = (due: string) => {
    if (filters.dueDateRange === 'all')     return true;
    if (filters.dueDateRange === 'overdue') return due < todayStr;
    const end = new Date();
    end.setDate(end.getDate() + (filters.dueDateRange === 'this-week' ? 7 : 30));
    return due >= todayStr && due <= localISO(end);
  };
  const filteredTasks = userFilteredTasks.filter(t =>
    (!filters.status || t.status === filters.status) && inDueRange(t.dueDate)
  );

  const anyFilterActive =
    effectiveUserIds.length > 0 || !!filters.status || filters.dueDateRange !== 'all';

  // Projects that have at least one task in the filtered set (for project table)
  const visibleProjectIds = new Set(filteredTasks.map(t => t.projectId));
  // Only fall back to every in-scope project when nothing is being filtered. The
  // old unconditional fallback meant a filter matching nothing rendered every
  // project at zero progress, which read as the data having vanished.
  const tableProjectIds = anyFilterActive ? visibleProjectIds : filteredProjectIds;
  const visibleCompanies = accessibleCompanies.filter(c =>
    [...tableProjectIds].some(pid => {
      const p = accessibleProjects.find(pp => pp.id === pid);
      return p?.companyId === c.id;
    })
  );

  // ── Stats ─────────────────────────────────────────────────────────────────
  const today = localISO();
  const done    = filteredTasks.filter(t => t.status === 'Concluído').length;
  const inProg  = filteredTasks.filter(t => t.status === 'Em andamento').length;
  const blocked = filteredTasks.filter(t => t.status === 'Bloqueado').length;
  const overdue = filteredTasks.filter(t => t.dueDate < today && t.status !== 'Concluído').length;

  const tz        = { timeZone: 'America/Sao_Paulo' } as const;
  const dayOfWeek = new Date().toLocaleDateString('pt-BR', { weekday: 'long', ...tz });
  const dateStr   = new Date().toLocaleDateString('pt-BR', { month: 'long', day: 'numeric', year: 'numeric', ...tz });

  return (
    <div className="flex-1 overflow-auto bg-[#F5F6F8]">
      <div className="px-4 py-6 md:px-10 lg:px-14 md:py-10 lg:py-12 space-y-6 md:space-y-10">

        {/* Welcome + view toggle */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl font-bold text-gray-900">
              {new Date().getHours() < 12 ? 'Bom dia' : 'Boa tarde'} 👋
            </h1>
            <p className="text-sm text-gray-400 mt-2">{dayOfWeek}, {dateStr}</p>
          </div>

          {/* View toggle pills */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shrink-0">
            <button
              onClick={() => setDashView('overview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                dashView === 'overview'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              <LayoutList size={13} />
              Visão Geral
            </button>
            <button
              onClick={() => setDashView('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                dashView === 'calendar'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              <CalendarDays size={13} />
              Calendário
            </button>
          </div>
        </div>

        {/* Filter bar — always visible */}
        <FilterBar
          companies={accessibleCompanies}
          teams={teams}
          teamMembers={teamMembers}
          selectedCompanyIds={selectedCompanyIds}
          selectedTeamIds={selectedTeamIds}
          selectedUserIds={selectedUserIds}
          onToggleCompany={toggleCompany}
          onToggleTeam={toggleTeam}
          onToggleUser={toggleUser}
          onClearCompanies={clearCompanies}
          onClearTeams={clearTeams}
          onClearMembers={clearMembers}
          onClearAll={clearAll}
          filteredCount={filteredTasks.length}
          totalCount={tasks.filter(t => accessProjectIds.includes(t.projectId)).length}
          currentUserId={currentUserId}
          isAdminOrManager={isAdminOrManager}
        />

        {dashView === 'calendar' ? (
          /* ── Calendar view ── */
          <DashboardCalendar tasks={filteredTasks} />
        ) : (
          /* ── Overview view ── */
          <>
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
              {visibleCompanies.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-100 py-12 text-center text-[13px] text-gray-400">
                  Nenhuma tarefa para os filtros selecionados
                </div>
              )}
              {visibleCompanies.map(c => (
                <ProjectGroupTable
                  key={c.id}
                  company={c}
                  activeTasks={filteredTasks}
                  visibleProjectIds={tableProjectIds}
                />
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
