import { useEffect, useRef, useState } from 'react';
import { Plus, LayoutGrid, List, CalendarDays, Users, AlertTriangle, Layers, Settings2, EyeOff, Eye, Clock, Ban, X, Trash2, Pencil, FileText, ArrowUpDown, Check, Link, Download } from 'lucide-react';
import type { Task } from '../../types';
import { hasAdminPower, getAssigneeIds } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { PhaseColumn } from './PhaseColumn';
import { TeamPanel } from './TeamPanel';
import { TaskListView } from './TaskListView';
import { CalendarView } from './CalendarView';
import { ApplyTemplateModal } from '../templates/ApplyTemplateModal';
import { PhaseEditor } from './PhaseEditor';
import { EditProjectModal } from './EditProjectModal';
import { ProjectDocumentView } from './ProjectDocumentView';
import { localISO } from '../../lib/date';

type ViewMode = 'board' | 'list' | 'calendar' | 'document';
const viewLabel: Record<ViewMode, string> = { board: 'Quadro', list: 'Lista', calendar: 'Calendário', document: 'Documento' };

type SortBy = 'manual' | 'dueDate' | 'priority' | 'assignee' | 'title' | 'status';
const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'manual',   label: 'Manual (padrão)' },
  { value: 'dueDate',  label: 'Prazo'           },
  { value: 'priority', label: 'Prioridade'      },
  { value: 'assignee', label: 'Responsável'     },
  { value: 'title',    label: 'Nome'            },
  { value: 'status',   label: 'Status'          },
];

const PRIORITY_ORDER: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
const STATUS_ORDER: Record<string, number> = {
  'Em andamento': 0, 'Sprint': 1, 'Em revisão': 2, 'Bloqueado': 3, 'Backlog': 4, 'Concluído': 5,
};

export function makeTaskCompareFn(sortBy: SortBy, memberMap: Record<string, string>): ((a: Task, b: Task) => number) | null {
  if (sortBy === 'manual') return null;
  return (a, b) => {
    switch (sortBy) {
      case 'dueDate':  return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
      case 'priority': return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      case 'assignee': {
        const aName = (memberMap[a.assigneeIds?.[0] ?? a.assigneeId ?? ''] ?? '').toLowerCase();
        const bName = (memberMap[b.assigneeIds?.[0] ?? b.assigneeId ?? ''] ?? '').toLowerCase();
        return aName < bName ? -1 : aName > bName ? 1 : 0;
      }
      case 'title': {
        const at = a.title.toLowerCase();
        const bt = b.title.toLowerCase();
        return at < bt ? -1 : at > bt ? 1 : 0;
      }
      case 'status': return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      default:       return 0;
    }
  };
}

function sortTasks(tasks: Task[], sortBy: SortBy, memberMap: Record<string, string>): Task[] {
  const fn = makeTaskCompareFn(sortBy, memberMap);
  if (!fn) return tasks;
  return [...tasks].sort(fn);
}

export function KanbanBoard() {
  const { projects, tasks, companies, teamMembers, teams, currentUserId, activeProjectId, setActiveTask, addTask, deleteProject, setActiveCompany, updateProject } = useAppStore();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showTeam, setShowTeam] = useState(true);
  const [showDone, setShowDone] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPhaseEditor, setShowPhaseEditor] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showProblems, setShowProblems] = useState(false);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>('manual');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const problemsRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showProblems) return;
    const handler = (e: MouseEvent) => {
      if (problemsRef.current && !problemsRef.current.contains(e.target as Node)) {
        setShowProblems(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showProblems]);

  useEffect(() => {
    if (!showSortMenu) return;
    const handler = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSortMenu]);

  const project = projects.find(p => p.id === activeProjectId);
  if (!project) return null;

  const currentUser = teamMembers.find(m => m.id === currentUserId);
  const company = companies.find(c => c.id === project.companyId);
  const allProjectTasks = tasks.filter(t => t.projectId === project.id);
  const projectTasks = allProjectTasks.filter(t => !t.parentTaskId);
  const displayTasks = showDone ? allProjectTasks : allProjectTasks.filter(t => t.status !== 'Concluído');
  const displayTopLevel = showDone ? projectTasks : projectTasks.filter(t => t.status !== 'Concluído');

  // User filter (applied on top of showDone filter)
  // Gerentes de uma equipe associada a esta empresa também têm poder de Admin aqui
  const isAdminOrManager = hasAdminPower(currentUserId, project.companyId, teamMembers, teams);
  const projectMembers = teamMembers.filter(m => project.teamMemberIds.includes(m.id));
  const memberMap: Record<string, string> = Object.fromEntries(teamMembers.map(m => [m.id, m.name]));
  const userFiltered = selectedUserIds.length > 0;
  // Tasks can have several assignees; `assigneeId` is only the first of them.
  // Filtering on it alone hid every task where the picked member wasn't first.
  const matchesUser = (t: Task) => getAssigneeIds(t).some(id => selectedUserIds.includes(id));
  const filteredTasks = sortTasks(
    userFiltered ? displayTasks.filter(matchesUser) : displayTasks,
    sortBy, memberMap,
  );
  const filteredTopLevel = sortTasks(
    userFiltered ? displayTopLevel.filter(matchesUser) : displayTopLevel,
    sortBy, memberMap,
  );

  const toggleUser = (id: string) =>
    setSelectedUserIds(prev => prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]);

  const done = projectTasks.filter(t => t.status === 'Concluído').length;
  const blockedTasks = projectTasks.filter(t => t.status === 'Bloqueado');
  const today = localISO();
  const overdueTasks = projectTasks.filter(t => t.dueDate < today && t.status !== 'Concluído');
  const blocked = blockedTasks.length;
  const overdue = overdueTasks.length;
  const progress = projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0;

  const fmtShort = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });

  const handleAddTask = (phase: string) => {
    const newTask: Task = {
      id: `t${Date.now()}`,
      projectId: project.id,
      phase,
      title: 'New task',
      type: 'Copy',
      status: 'Backlog',
      priority: 'Medium',
      dueDate: localISO(new Date(Date.now() + 7 * 86400000)),
      createdAt: localISO(),
    };
    addTask(newTask);
    setTimeout(() => setActiveTask(newTask.id), 50);
  };

  const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });

  const handleExport = () => {
    const customCols = project.customColumns ?? [];
    const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;

    const headers = [
      'Categoria', 'Fase', 'Título', 'Tipo', 'Status', 'Prioridade',
      'Responsável', 'Prazo', 'Criado em', 'Descrição', 'Notas',
      ...customCols.map(c => c.name),
      'Subtarefa de',
    ];

    const itemCategory = (t: Task) => {
      if (t.isMilestone) return 'Marco';
      if (t.isMeta) return 'Meta';
      if (t.parentTaskId) return 'Subtarefa';
      return 'Tarefa';
    };

    const rows = allProjectTasks.map(t => {
      const assigneeNames = (t.assigneeIds ?? (t.assigneeId ? [t.assigneeId] : []))
        .map(id => memberMap[id] ?? id)
        .join(', ');
      const parentTitle = t.parentTaskId
        ? (allProjectTasks.find(p => p.id === t.parentTaskId)?.title ?? t.parentTaskId)
        : '';
      return [
        itemCategory(t),
        t.phase,
        t.title,
        t.type,
        t.status,
        t.priority,
        assigneeNames,
        t.dueDate,
        t.createdAt,
        t.description ?? '',
        t.notes ?? '',
        ...customCols.map(c => t.customFields?.[c.id] ?? ''),
        parentTitle,
      ].map(escape);
    });

    const csv = '﻿' + [headers.map(escape), ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${company?.name ?? 'Projeto'} - ${project.name} - ${localISO()}.csv`;
    // The anchor has to be in the document for Firefox to honour the click, and
    // revoking the blob URL in the same tick can abort the download before it
    // starts — both leave the user clicking Exportar with nothing happening.
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 bg-white">

      {/* Project Header */}
      <div className="border-b border-[#E5E7EB] shrink-0">

        {/* Top row: title + stats */}
        <div className="px-4 pt-5 pb-4 md:px-12 md:pt-8 md:pb-6 flex items-center justify-between gap-4 md:gap-10 flex-wrap">

          {/* Left: title + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-2.5">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: project.color }} />
              <h1 className="text-[20px] font-bold text-[#111] leading-tight truncate tracking-tight">{project.name}</h1>
              {isAdminOrManager && (
                <button
                  onClick={() => setShowEditProject(true)}
                  title="Editar projeto"
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-300 hover:text-[#1f6feb] transition-colors shrink-0"
                >
                  <Pencil size={13} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-4 ml-5">
              <span className="text-[12px] text-[#999]">
                {fmtDate(project.startDate)} → {fmtDate(project.endDate)}
              </span>
              {company && (
                <span className="text-[12px] text-[#999]">{company.name}</span>
              )}
              {(blocked > 0 || overdue > 0) && (
                <div ref={problemsRef} className="relative">
                  <button
                    onClick={() => setShowProblems(v => !v)}
                    className="text-[12px] text-red-500 font-medium hover:text-red-600 transition-colors"
                  >
                    {blocked + overdue} {blocked + overdue === 1 ? 'problema' : 'problemas'}
                  </button>
                  {showProblems && (
                    <div
                      className="absolute top-full left-0 mt-2 w-80 bg-white rounded-2xl border border-gray-150 z-50 overflow-hidden"
                      style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.14)' }}
                    >
                      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={13} className="text-red-500" />
                          <span className="text-[13px] font-bold text-gray-800">Problemas do projeto</span>
                        </div>
                        <button onClick={() => setShowProblems(false)} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
                          <X size={13} />
                        </button>
                      </div>
                      <div className="max-h-72 overflow-y-auto">
                        {overdueTasks.length > 0 && (
                          <div className="px-4 pt-3 pb-2">
                            <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <Clock size={10} />
                              Atrasadas ({overdueTasks.length})
                            </p>
                            <div className="flex flex-col gap-1">
                              {overdueTasks.map(t => (
                                <button
                                  key={t.id}
                                  onClick={() => { setActiveTask(t.id); setShowProblems(false); }}
                                  className="flex items-center justify-between w-full text-left rounded-lg px-2.5 py-2 hover:bg-orange-50 transition-colors group"
                                >
                                  <span className="text-[12px] text-gray-700 truncate group-hover:text-orange-700">{t.title}</span>
                                  <span className="text-[11px] text-orange-500 font-medium shrink-0 ml-2">
                                    {fmtShort(t.dueDate)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {blockedTasks.length > 0 && (
                          <div className="px-4 pt-2 pb-3">
                            {overdueTasks.length > 0 && <div className="border-t border-gray-100 mb-2" />}
                            <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <Ban size={10} />
                              Bloqueadas ({blockedTasks.length})
                            </p>
                            <div className="flex flex-col gap-1">
                              {blockedTasks.map(t => (
                                <button
                                  key={t.id}
                                  onClick={() => { setActiveTask(t.id); setShowProblems(false); }}
                                  className="flex items-center justify-between w-full text-left rounded-lg px-2.5 py-2 hover:bg-red-50 transition-colors group"
                                >
                                  <span className="text-[12px] text-gray-700 truncate group-hover:text-red-700">{t.title}</span>
                                  <span className="text-[11px] text-red-400 font-medium shrink-0 ml-2">{t.phase}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: big number stats — hidden on smallest screens */}
          <div className="hidden sm:flex items-center gap-6 md:gap-9 shrink-0">
            <div className="text-center">
              <p className="text-[28px] font-bold text-[#111] leading-none">{projectTasks.length}</p>
              <p className="text-[11px] text-[#999] mt-1.5">tarefas</p>
            </div>
            <div className="w-px h-10 bg-[#E5E7EB]" />
            <div className="text-center">
              <p className="text-[28px] font-bold text-[#111] leading-none">{done}</p>
              <p className="text-[11px] text-[#999] mt-1.5">concluídas</p>
            </div>
            <div className="w-px h-10 bg-[#E5E7EB]" />
            <div className="text-center">
              <p className="text-[28px] font-bold text-[#111] leading-none">{progress}%</p>
              <p className="text-[11px] text-[#999] mt-1.5">progresso</p>
            </div>
          </div>
        </div>

        {/* Bottom row: view tabs + actions */}
        <div className="px-4 md:px-12 flex items-center justify-between gap-2 flex-wrap">
          {/* View tabs */}
          <div className="flex items-center">
            {(['board', 'list', 'calendar', 'document'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium border-b-2 transition-colors ${viewMode === v ? 'border-[#1f6feb] text-[#1f6feb]' : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'}`}
              >
                {v === 'board' ? <LayoutGrid size={13} /> : v === 'list' ? <List size={13} /> : v === 'calendar' ? <CalendarDays size={13} /> : <FileText size={13} />}
                {viewLabel[v]}
              </button>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setShowDone(v => !v)}
              className={`h-7 flex items-center gap-1.5 px-2.5 rounded-md text-[12px] font-medium border transition-colors ${!showDone ? 'border-[#1f6feb]/30 bg-[#1f6feb]/5 text-[#1f6feb]' : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'}`}
            >
              {showDone ? <Eye size={12} /> : <EyeOff size={12} />}
              <span className="hidden sm:inline">Concluídas</span>
            </button>
            <button
              onClick={() => setShowTemplates(true)}
              className="hidden sm:flex h-7 items-center gap-1.5 px-2.5 rounded-md text-[12px] font-medium border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
            >
              <Layers size={12} />
              Modelos
            </button>
            <button
              onClick={() => setShowTeam(s => !s)}
              className={`hidden sm:flex h-7 items-center gap-1.5 px-2.5 rounded-md text-[12px] font-medium border transition-colors ${showTeam ? 'border-[#1f6feb]/30 bg-[#1f6feb]/5 text-[#1f6feb]' : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'}`}
            >
              <Users size={12} />
              Equipe
            </button>
            <button
              onClick={() => setShowPhaseEditor(true)}
              className="hidden sm:flex h-7 items-center gap-1.5 px-2.5 rounded-md text-[12px] font-medium border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
            >
              <Settings2 size={12} />
              Fases
            </button>
            {/* Sort dropdown */}
            <div ref={sortMenuRef} className="relative">
              <button
                onClick={() => setShowSortMenu(v => !v)}
                className={`h-7 flex items-center gap-1.5 px-2.5 rounded-md text-[12px] font-medium border transition-colors ${sortBy !== 'manual' ? 'border-[#1f6feb]/30 bg-[#1f6feb]/5 text-[#1f6feb]' : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'}`}
              >
                <ArrowUpDown size={12} />
                <span className="hidden sm:inline">{sortBy === 'manual' ? 'Ordenar' : SORT_OPTIONS.find(o => o.value === sortBy)?.label}</span>
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-1.5 bg-white rounded-xl border border-gray-150 shadow-xl z-50 py-1.5 min-w-[180px]" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                  <p className="px-3 py-1.5 text-[10px] font-bold text-gray-300 uppercase tracking-wider">Ordenar por</p>
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setSortBy(opt.value); setShowSortMenu(false); }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-[13px] hover:bg-gray-50 transition-colors ${sortBy === opt.value ? 'text-[#1f6feb] font-semibold' : 'text-gray-700'}`}
                    >
                      {opt.label}
                      {sortBy === opt.value && <Check size={12} className="text-[#1f6feb]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                const url = `${window.location.origin}${window.location.pathname}?project=${project.id}`;
                navigator.clipboard.writeText(url).then(() => {
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                });
              }}
              className="h-7 flex items-center gap-1.5 px-2.5 rounded-md text-[12px] font-semibold transition-all"
              style={linkCopied ? { backgroundColor: '#16a34a', color: '#fff' } : { backgroundColor: '#1f6feb', color: '#fff' }}
            >
              {linkCopied ? <><Check size={12} /> Copiado!</> : <><Link size={12} /> Compartilhar</>}
            </button>
            <button
              onClick={handleExport}
              className="h-7 flex items-center gap-1.5 px-2.5 rounded-md text-[12px] font-semibold border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800 transition-colors"
              title="Exportar tarefas do projeto em CSV"
            >
              <Download size={12} />
              Exportar
            </button>
            <button
              onClick={() => handleAddTask(project.phases[0]?.name ?? 'Production')}
              className="h-7 flex items-center gap-1.5 px-3 rounded-md text-[12px] font-semibold text-white"
              style={{ backgroundColor: '#1f6feb' }}
            >
              <Plus size={13} />
              Nova tarefa
            </button>
            <button
              onClick={() => setConfirmDeleteProject(true)}
              className="h-7 w-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
              title="Apagar projeto"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Member filter bar */}
        {(projectMembers.length > 0 || currentUserId) && (
          <div className="px-4 md:px-12 py-2.5 flex items-center gap-2.5 border-t border-[#E5E7EB] flex-wrap">
            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider shrink-0">Responsável</span>

            {/* "Todos" — only for admins/managers */}
            {isAdminOrManager && (
              <button
                onClick={() => setSelectedUserIds([])}
                className="h-6 px-2.5 rounded-full text-[11px] font-semibold transition-all shrink-0"
                style={!userFiltered
                  ? { backgroundColor: '#1f6feb', color: '#fff' }
                  : { backgroundColor: '#f3f4f6', color: '#9ca3af' }}
              >
                Todos
              </button>
            )}

            {/* "EU" chip — for everyone */}
            {currentUserId && projectMembers.some(m => m.id === currentUserId) && (
              <button
                onClick={() => toggleUser(currentUserId)}
                className="h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-semibold transition-all shrink-0"
                style={selectedUserIds.includes(currentUserId)
                  ? { backgroundColor: currentUser?.color ?? '#1f6feb', color: '#fff' }
                  : !isAdminOrManager && !userFiltered
                    ? { backgroundColor: '#1f6feb', color: '#fff' }  // default "active" for non-admins
                    : { backgroundColor: '#f3f4f6', color: '#6b7280' }}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0"
                  style={{
                    backgroundColor: selectedUserIds.includes(currentUserId) || (!isAdminOrManager && !userFiltered)
                      ? 'rgba(255,255,255,0.3)' : (currentUser?.color ?? '#1f6feb'),
                    color: '#fff',
                  }}
                >
                  {currentUser?.avatar}
                </span>
                EU
              </button>
            )}

            {/* All other member chips — only for admins/managers */}
            {isAdminOrManager && projectMembers
              .filter(m => m.id !== currentUserId)
              .map(m => {
                const active = selectedUserIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleUser(m.id)}
                    className="h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-semibold transition-all shrink-0"
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

            {userFiltered && (
              <span className="text-[11px] text-gray-400 ml-auto shrink-0">
                {filteredTopLevel.length} de {displayTopLevel.length} tarefas
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden bg-white">

        {/* Document view — full width, no member filter/team panel */}
        {viewMode === 'document' && (
          <ProjectDocumentView
            key={project.id}
            projectId={project.id}
            initialContent={project.document ?? ''}
            projectColor={project.color}
            onSave={html => updateProject(project.id, { document: html })}
          />
        )}

        {viewMode === 'board' ? (
          <div className="flex-1 overflow-x-auto px-8 py-6">
            <div className="flex gap-4 h-full" style={{ minWidth: 'max-content' }}>
              {project.phases.map(ph => (
                <PhaseColumn
                  key={ph.id}
                  phase={ph.name}
                  tasks={filteredTopLevel.filter(t => t.phase === ph.name)}
                  onAddTask={handleAddTask}
                />
              ))}
            </div>
          </div>
        ) : viewMode === 'list' ? (
          <TaskListView tasks={filteredTasks} projectColor={project.color} phases={project.phases} projectId={project.id} customColumns={project.customColumns ?? []} sortFn={makeTaskCompareFn(sortBy, memberMap)} />
        ) : null}

        {viewMode === 'calendar' && (
          <CalendarView
            tasks={filteredTasks}
            projectColor={project.color}
            onTaskClick={setActiveTask}
            onAddTask={(date) => {
              const newTask: Task = {
                id: `t${Date.now()}`,
                projectId: project.id,
                phase: project.phases[0]?.name ?? 'Produção',
                title: 'New task',
                type: 'Copy',
                status: 'Backlog',
                priority: 'Medium',
                dueDate: date,
                createdAt: localISO(),
              };
              addTask(newTask);
              setTimeout(() => setActiveTask(newTask.id), 50);
            }}
          />
        )}

        {/* Team panel — only in board view */}
        {showTeam && viewMode === 'board' && (
          <div className="w-60 shrink-0 bg-white border-l border-gray-100 overflow-y-auto p-6">
            <TeamPanel projectId={project.id} />
          </div>
        )}
      </div>

      {showTemplates && (
        <ApplyTemplateModal
          projectId={project.id}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {showPhaseEditor && (
        <PhaseEditor
          projectId={project.id}
          phases={project.phases}
          onClose={() => setShowPhaseEditor(false)}
        />
      )}

      {showEditProject && (
        <EditProjectModal project={project} onClose={() => setShowEditProject(false)} />
      )}

      {confirmDeleteProject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setConfirmDeleteProject(false)}>
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  <AlertTriangle size={16} className="text-red-500" />
                </div>
                <h2 className="text-[15px] font-bold text-gray-900">Apagar "{project.name}"?</h2>
              </div>
              <p className="text-[13px] text-gray-500 leading-relaxed">
                Isso apagará permanentemente o projeto e todas as suas <strong>{tasks.filter(t => t.projectId === project.id).length}</strong> tarefas. Essa ação não pode ser desfeita.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
              <button
                onClick={() => { deleteProject(project.id); setActiveCompany(company?.id ?? null); setConfirmDeleteProject(false); }}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Sim, apagar
              </button>
              <button onClick={() => setConfirmDeleteProject(false)} className="px-4 py-2.5 rounded-xl text-[13px] text-gray-500 hover:bg-gray-100 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
