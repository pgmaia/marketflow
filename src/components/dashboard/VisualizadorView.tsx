import { AlertTriangle, Calendar, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { Project, Task } from '../../types';
import { localISO } from '../../lib/date';

// ─── Circular progress ring ───────────────────────────────────────────────────

function ProgressRing({
  pct,
  size = 72,
  stroke = 7,
  color,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
}

// ─── Health badge ─────────────────────────────────────────────────────────────

function HealthBadge({ pct }: { pct: number }) {
  if (pct >= 70) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-600">
      <CheckCircle2 size={9} /> No prazo
    </span>
  );
  if (pct >= 40) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-600">
      <Clock size={9} /> Atenção
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600">
      <AlertTriangle size={9} /> Crítico
    </span>
  );
}

// ─── Project card ─────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  tasks,
  companyName,
  companyColor,
  companyLogo,
}: {
  project: Project;
  tasks: Task[];
  companyName: string;
  companyColor: string;
  companyLogo: string;
}) {
  const today = localISO();

  const total    = tasks.length;
  const done     = tasks.filter(t => t.status === 'Concluído').length;
  const inProg   = tasks.filter(t => t.status === 'Em andamento').length;
  const blocked  = tasks.filter(t => t.status === 'Bloqueado').length;
  const overdue  = tasks.filter(t => t.dueDate < today && t.status !== 'Concluído').length;
  const pct      = total ? Math.round((done / total) * 100) : 0;
  const ringColor = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';

  const nextTask = tasks
    .filter(t => t.dueDate >= today && t.status !== 'Concluído')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Top: company tag + health */}
      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-white"
          style={{ backgroundColor: companyColor }}
        >
          <span className="opacity-80">{companyLogo}</span>
          {companyName}
        </span>
        <HealthBadge pct={pct} />
      </div>

      {/* Middle: ring + info */}
      <div className="flex items-center gap-5">
        {/* Ring */}
        <div className="relative shrink-0" style={{ width: 72, height: 72 }}>
          <ProgressRing pct={pct} color={ringColor} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[15px] font-bold text-gray-800 leading-none">{pct}%</span>
            <span className="text-[9px] text-gray-400 mt-0.5">concluído</span>
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[15px] text-gray-800 leading-snug truncate">{project.name}</p>
          {project.description && (
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">{project.description}</p>
          )}
          <p className="text-[11px] text-gray-400 mt-2">{done} de {total} tarefas concluídas</p>
        </div>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-1.5">
        {inProg > 0 && (
          <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600">
            {inProg} em andamento
          </span>
        )}
        {blocked > 0 && (
          <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-red-50 text-red-500">
            {blocked} bloqueada{blocked > 1 ? 's' : ''}
          </span>
        )}
        {overdue > 0 && (
          <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-600">
            {overdue} atrasada{overdue > 1 ? 's' : ''}
          </span>
        )}
        {!inProg && !blocked && !overdue && total > 0 && (
          <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-gray-50 text-gray-400">
            Tudo certo ✓
          </span>
        )}
      </div>

      {/* Next deadline */}
      {nextTask && (
        <div className="pt-3 border-t border-gray-100 flex items-center gap-1.5 text-[11px] text-gray-400">
          <Calendar size={11} />
          <span>Próximo prazo:</span>
          <span className="font-semibold text-gray-600">{fmtDate(nextTask.dueDate)}</span>
          <span className="truncate ml-1 text-gray-400">— {nextTask.title}</span>
        </div>
      )}
    </div>
  );
}

// ─── Alert row ─────────────────────────────────────────────────────────────────

function AlertRow({ task, projectName }: { task: Task; projectName: string }) {
  const today = localISO();
  const isOverdue = task.dueDate < today && task.status !== 'Concluído';
  const isBlocked = task.status === 'Bloqueado';

  const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <span
        className="w-2 h-2 rounded-full shrink-0 mt-0.5"
        style={{ backgroundColor: isBlocked ? '#ef4444' : '#f59e0b' }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-gray-700 truncate">{task.title}</p>
        <p className="text-[10px] text-gray-400 truncate">{projectName}</p>
      </div>
      <div className="shrink-0 text-right">
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isBlocked ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600'}`}
        >
          {isBlocked ? 'Bloqueada' : `Atrasada ${fmtDate(task.dueDate)}`}
        </span>
      </div>
    </div>
  );
}

// ─── Upcoming task row ─────────────────────────────────────────────────────────

function UpcomingRow({ task, projectName, projectColor }: { task: Task; projectName: string; projectColor: string }) {
  const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', month: 'short', day: 'numeric' });

  const today   = localISO();
  const diffMs  = new Date(task.dueDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime();
  const diffDays = Math.round(diffMs / 86400000);
  const soon    = diffDays <= 2;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: projectColor }} />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-gray-700 truncate">{task.title}</p>
        <p className="text-[10px] text-gray-400 truncate">{projectName}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-[11px] font-semibold ${soon ? 'text-amber-500' : 'text-gray-500'}`}>
          {fmtDate(task.dueDate)}
        </p>
        {diffDays === 0 && <p className="text-[9px] text-amber-500 font-bold">Hoje</p>}
        {diffDays === 1 && <p className="text-[9px] text-amber-500 font-bold">Amanhã</p>}
        {diffDays > 1  && diffDays <= 7 && <p className="text-[9px] text-gray-400">em {diffDays}d</p>}
      </div>
    </div>
  );
}

// ─── Big stat ──────────────────────────────────────────────────────────────────

function BigStat({
  value,
  label,
  sub,
  icon: Icon,
  color,
}: {
  value: number | string;
  label: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center gap-4 shadow-sm">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: color + '18' }}
      >
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-[12px] text-gray-500 mt-1 font-medium">{label}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function VisualizadorView() {
  const {
    tasks, projects, companies, teamMembers, currentUserId,
    memberCompanyAccess, memberAccess,
  } = useAppStore();

  const currentUser = teamMembers.find(m => m.id === currentUserId);

  // ── Access control ────────────────────────────────────────────────────────
  const accessCompanyIds = memberCompanyAccess[currentUserId ?? ''] ?? companies.map(c => c.id);
  const accessProjectIds = memberAccess[currentUserId ?? ''] ?? projects.map(p => p.id);

  const myCompanies = companies.filter(c => accessCompanyIds.includes(c.id));
  const myProjects  = projects.filter(
    p => accessProjectIds.includes(p.id) && accessCompanyIds.includes(p.companyId)
  );
  const myProjectIds = new Set(myProjects.map(p => p.id));
  const myTasks     = tasks.filter(t => myProjectIds.has(t.projectId) && !t.parentTaskId);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const today     = localISO();
  const doneCount = myTasks.filter(t => t.status === 'Concluído').length;
  const overallPct = myTasks.length ? Math.round((doneCount / myTasks.length) * 100) : 0;

  const alertTasks = myTasks
    .filter(t => t.status === 'Bloqueado' || (t.dueDate < today && t.status !== 'Concluído'))
    .sort((a, b) => {
      // Bloqueado first, then by dueDate
      if (a.status === 'Bloqueado' && b.status !== 'Bloqueado') return -1;
      if (b.status === 'Bloqueado' && a.status !== 'Bloqueado') return 1;
      return a.dueDate.localeCompare(b.dueDate);
    })
    .slice(0, 8);

  const upcomingTasks = myTasks
    .filter(t => t.dueDate >= today && t.status !== 'Concluído')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 8);

  // ── Time greeting ─────────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = currentUser?.name.split(' ')[0] ?? '';

  const tz      = { timeZone: 'America/Sao_Paulo' } as const;
  const dateStr = new Date().toLocaleDateString('pt-BR', { weekday: 'long', month: 'long', day: 'numeric', ...tz });

  return (
    <div className="flex-1 overflow-auto bg-[#F5F6F8]">
      <div className="px-5 py-8 md:px-12 md:py-10 lg:px-16 max-w-5xl mx-auto space-y-8">

        {/* Greeting */}
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">
            {greeting}{firstName ? `, ${firstName}` : ''} 👋
          </h1>
          <p className="text-sm text-gray-400 mt-1.5 capitalize">{dateStr}</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <BigStat
            value={myProjects.length}
            label="Projetos ativos"
            sub={`em ${myCompanies.length} empresa${myCompanies.length !== 1 ? 's' : ''}`}
            icon={TrendingUp}
            color="#6366f1"
          />
          <BigStat
            value={`${overallPct}%`}
            label="Concluído"
            sub={`${doneCount} de ${myTasks.length} tarefas`}
            icon={CheckCircle2}
            color="#22c55e"
          />
          <BigStat
            value={myTasks.filter(t => t.status === 'Em andamento').length}
            label="Em andamento"
            icon={Clock}
            color="#3b82f6"
          />
          <BigStat
            value={alertTasks.length}
            label="Precisam atenção"
            sub={alertTasks.length ? 'Ver alertas abaixo' : 'Tudo certo!'}
            icon={AlertTriangle}
            color={alertTasks.length ? '#ef4444' : '#22c55e'}
          />
        </div>

        {/* Alerts */}
        {alertTasks.length > 0 && (
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-6 py-4 bg-red-50 border-b border-red-100">
              <AlertTriangle size={15} className="text-red-500 shrink-0" />
              <p className="font-bold text-[13px] text-red-600">
                {alertTasks.length} tarefa{alertTasks.length !== 1 ? 's' : ''} precisam de atenção
              </p>
            </div>
            <div className="px-6 py-2">
              {alertTasks.map(t => {
                const proj = myProjects.find(p => p.id === t.projectId);
                return (
                  <AlertRow
                    key={t.id}
                    task={t}
                    projectName={proj?.name ?? '—'}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Project cards grid */}
        {myProjects.length > 0 && (
          <div>
            <h2 className="font-bold text-[14px] text-gray-700 mb-4">Seus Projetos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myProjects.map(proj => {
                const company = companies.find(c => c.id === proj.companyId);
                const projTasks = myTasks.filter(t => t.projectId === proj.id);
                return (
                  <ProjectCard
                    key={proj.id}
                    project={proj}
                    tasks={projTasks}
                    companyName={company?.name ?? ''}
                    companyColor={company?.color ?? '#9ca3af'}
                    companyLogo={company?.logo ?? '?'}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Upcoming tasks */}
        {upcomingTasks.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-100">
              <Calendar size={15} className="text-gray-400 shrink-0" />
              <p className="font-bold text-[13px] text-gray-700">Próximos prazos</p>
            </div>
            <div className="px-6 py-2">
              {upcomingTasks.map(t => {
                const proj = myProjects.find(p => p.id === t.projectId);
                return (
                  <UpcomingRow
                    key={t.id}
                    task={t}
                    projectName={proj?.name ?? '—'}
                    projectColor={proj?.color ?? '#9ca3af'}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {myProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <TrendingUp size={28} className="text-gray-300" />
            </div>
            <p className="text-[15px] font-semibold text-gray-500">Nenhum projeto visível</p>
            <p className="text-[12px] text-gray-400 mt-1">Aguarde o administrador liberar seu acesso.</p>
          </div>
        )}

      </div>
    </div>
  );
}
