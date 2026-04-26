import { useState } from 'react';
import { Calendar, ArrowRight, Plus, X, FolderKanban, Trash2, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { ProgressBar } from '../shared/ProgressBar';
import { AvatarGroup } from '../shared/Avatar';
import { DEFAULT_PHASES } from '../../data/seed';

// ─── Confirm delete modal ─────────────────────────────────────────────────────

function ConfirmDeleteModal({
  title,
  description,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ width: 400 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-red-500" />
            </div>
            <h2 className="text-[15px] font-bold text-gray-900">{title}</h2>
          </div>
          <p className="text-[13px] text-gray-500 leading-relaxed">{description}</p>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
          >
            Sim, apagar
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-[13px] text-gray-500 hover:bg-gray-100 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Color palette ────────────────────────────────────────────────────────────

const PROJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#22c55e', '#14b8a6', '#3b82f6',
  '#FF5C35', '#64748b',
];

// ─── New project modal ────────────────────────────────────────────────────────

function NewProjectModal({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const { addProject, setActiveProject } = useAppStore();

  const today = new Date().toISOString().split('T')[0];
  const defaultEnd = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(defaultEnd);

  const canSubmit = name.trim().length > 0;

  const handleCreate = () => {
    if (!canSubmit) return;
    const ts = Date.now();
    const projectId = `proj-${ts}`;

    addProject({
      id: projectId,
      companyId,
      name: name.trim(),
      description: description.trim(),
      startDate,
      endDate,
      teamMemberIds: [],
      color,
      phases: DEFAULT_PHASES.map((ph, i) => ({ id: `${projectId}-ph-${i}`, name: ph.name })),
    });

    setActiveProject(projectId);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 460 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-5 flex items-start justify-between border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
              <FolderKanban size={15} style={{ color }} />
            </div>
            <h2 className="text-[15px] font-bold text-[#111]">Novo projeto</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Nome *</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canSubmit) handleCreate(); if (e.key === 'Escape') onClose(); }}
              placeholder="Ex: Campanha de Verão 2026"
              className="mt-1.5 w-full text-[14px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#FF5C35] transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Descrição <span className="font-normal normal-case">(opcional)</span></label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descreva o objetivo do projeto..."
              className="mt-1.5 w-full text-[14px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#FF5C35] transition-colors"
            />
          </div>

          {/* Color + dates row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Color */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Cor</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {PROJECT_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: color === c ? '#111' : 'transparent',
                      boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Dates */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Período</label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="flex-1 text-[12px] bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:border-[#FF5C35] transition-colors"
                />
                <span className="text-gray-300 text-[11px] shrink-0">→</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="flex-1 text-[12px] bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:border-[#FF5C35] transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Default phases preview */}
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Fases criadas automaticamente</p>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_PHASES.map((ph, i) => (
                <span
                  key={ph.id}
                  className="text-[11px] px-2.5 py-1 rounded-full font-medium text-white"
                  style={{ backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length] }}
                >
                  {ph.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={handleCreate}
            disabled={!canSubmit}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: '#FF5C35' }}
          >
            Criar projeto
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-[13px] text-gray-500 hover:bg-gray-100 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Company view ─────────────────────────────────────────────────────────────

export function CompanyView() {
  const { companies, activeCompanyId, projects, tasks, teamMembers, setActiveProject, deleteCompany, deleteProject, setActiveCompany } = useAppStore();
  const [showNewProject, setShowNewProject] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<null | { type: 'company' } | { type: 'project'; id: string; name: string }>(null);

  const company = companies.find(c => c.id === activeCompanyId);
  if (!company) return null;

  const companyProjects = projects.filter(p => p.companyId === company.id);
  const today = new Date().toISOString().split('T')[0];

  const allTasks = tasks.filter(t => companyProjects.some(p => p.id === t.projectId));
  const done = allTasks.filter(t => t.status === 'Done').length;
  const health = allTasks.length ? Math.round((done / allTasks.length) * 100) : 0;
  const formatDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });

  return (
    <div className="flex-1 overflow-auto bg-[#F5F6F8]">
      <div className="px-14 py-12 space-y-10">

        {/* Company hero header */}
        <div className="bg-white rounded-xl border border-gray-100 px-10 py-8 flex items-center gap-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0 shadow-lg" style={{ backgroundColor: company.color }}>
            {company.logo}
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <h1 className="font-display text-xl font-bold text-gray-900 truncate">{company.name}</h1>
            <p className="text-[13px] text-gray-400 mt-1 truncate">{company.industry} · {companyProjects.length} projetos ativos · {allTasks.length} tarefas no total</p>
          </div>
          <div className="text-right shrink-0 pl-2">
            <p className="text-2xl font-bold leading-none" style={{ color: health >= 70 ? '#22c55e' : health >= 40 ? '#f59e0b' : '#ef4444' }}>{health}%</p>
            <p className="text-[11px] text-gray-400 mt-1.5">saúde geral</p>
          </div>
          <button
            onClick={() => setConfirmDelete({ type: 'company' })}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors shrink-0"
            title="Apagar empresa"
          >
            <Trash2 size={15} />
          </button>
        </div>

        {/* Projects section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[14px] text-gray-700">Projetos</h2>
            <button
              onClick={() => setShowNewProject(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#FF5C35' }}
            >
              <Plus size={13} />
              Novo projeto
            </button>
          </div>

          {companyProjects.length === 0 ? (
            /* Empty state */
            <div className="bg-white rounded-xl border border-gray-100 border-dashed py-16 flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                <FolderKanban size={22} className="text-gray-300" />
              </div>
              <div className="text-center">
                <p className="text-[14px] font-semibold text-gray-500">Nenhum projeto ainda</p>
                <p className="text-[13px] text-gray-400 mt-1">Crie o primeiro projeto desta empresa</p>
              </div>
              <button
                onClick={() => setShowNewProject(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#FF5C35' }}
              >
                <Plus size={14} />
                Criar projeto
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">

                {/* Column headers */}
                <div className="grid text-[11px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100 px-8 py-4 bg-gray-50/70 whitespace-nowrap" style={{ gridTemplateColumns: '240px 170px 180px 80px 140px 110px 36px', minWidth: '960px' }}>
                  <span>Projeto</span>
                  <span>Progresso</span>
                  <span>Tarefas</span>
                  <span>Saúde</span>
                  <span>Próximo prazo</span>
                  <span>Equipe</span>
                  <span />
                </div>

                {companyProjects.map((project, i) => {
                  const projTasks = tasks.filter(t => t.projectId === project.id);
                  const projDone = projTasks.filter(t => t.status === 'Done').length;
                  const inProg = projTasks.filter(t => t.status === 'In Progress').length;
                  const blocked = projTasks.filter(t => t.status === 'Blocked').length;
                  const overdue = projTasks.filter(t => t.dueDate < today && t.status !== 'Done').length;
                  const projHealth = projTasks.length ? Math.round((projDone / projTasks.length) * 100) : 0;
                  const healthColor = projHealth >= 70 ? '#22c55e' : projHealth >= 40 ? '#f59e0b' : '#ef4444';
                  const members = project.teamMemberIds.map(id => teamMembers.find(m => m.id === id)!).filter(Boolean);
                  const nextTask = projTasks.filter(t => t.dueDate >= today && t.status !== 'Done').sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

                  return (
                    <div
                      key={project.id}
                      onClick={() => setActiveProject(project.id)}
                      className={`grid items-center px-8 py-5 cursor-pointer hover:bg-gray-50/70 transition-colors group ${i > 0 ? 'border-t border-gray-100' : ''}`}
                      style={{ gridTemplateColumns: '240px 170px 180px 80px 140px 110px 36px', minWidth: '960px' }}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-4">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: project.color }} />
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-gray-800 truncate group-hover:text-[#FF5C35] transition-colors">{project.name}</p>
                          <p className="text-[11px] text-gray-400 truncate mt-0.5">{project.description || '—'}</p>
                        </div>
                      </div>

                      <div className="pr-6">
                        <ProgressBar value={projHealth} color={project.color} />
                        <p className="text-[10px] text-gray-400 mt-1.5">{projDone} de {projTasks.length} concluídas</p>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {inProg > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">{inProg} ativo{inProg > 1 ? 's' : ''}</span>}
                        {blocked > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">{blocked} bloqueada{blocked > 1 ? 's' : ''}</span>}
                        {overdue > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">{overdue} atrasada{overdue > 1 ? 's' : ''}</span>}
                        {!inProg && !blocked && !overdue && <span className="text-[11px] text-gray-400">{projTasks.length} tarefas</span>}
                      </div>

                      <div>
                        <span className="text-[13px] font-bold" style={{ color: healthColor }}>{projHealth}%</span>
                      </div>

                      <div>
                        {nextTask
                          ? <div className="flex items-center gap-1 text-[11px] text-gray-500"><Calendar size={10} /><span>{formatDate(nextTask.dueDate)}</span></div>
                          : <span className="text-[11px] text-gray-300">—</span>}
                      </div>

                      <div><AvatarGroup members={members} max={3} size="sm" /></div>

                      <div className="flex justify-end items-center gap-1">
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmDelete({ type: 'project', id: project.id, name: project.name }); }}
                          className="w-6 h-6 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all"
                          title="Apagar projeto"
                        >
                          <Trash2 size={12} />
                        </button>
                        <ArrowRight size={13} className="text-gray-300 group-hover:text-[#FF5C35] transition-colors" />
                      </div>
                    </div>
                  );
                })}

                {/* Inline add project row */}
                <div
                  onClick={() => setShowNewProject(true)}
                  className="flex items-center gap-2 px-8 py-3.5 border-t border-gray-100 cursor-pointer hover:bg-[#FF5C35]/5 transition-colors group"
                  style={{ minWidth: '960px' }}
                >
                  <Plus size={12} className="text-gray-300 group-hover:text-[#FF5C35] transition-colors shrink-0" />
                  <span className="text-[12px] text-gray-400 group-hover:text-[#FF5C35] transition-colors">Novo projeto</span>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>

      {showNewProject && (
        <NewProjectModal
          companyId={company.id}
          onClose={() => setShowNewProject(false)}
        />
      )}

      {confirmDelete?.type === 'company' && (
        <ConfirmDeleteModal
          title={`Apagar "${company.name}"?`}
          description={`Isso apagará permanentemente a empresa e todos os seus ${companyProjects.length} projeto(s) e tarefas. Essa ação não pode ser desfeita.`}
          onConfirm={() => { deleteCompany(company.id); setActiveCompany(null); setConfirmDelete(null); }}
          onClose={() => setConfirmDelete(null)}
        />
      )}

      {confirmDelete?.type === 'project' && (
        <ConfirmDeleteModal
          title={`Apagar "${confirmDelete.name}"?`}
          description="Isso apagará permanentemente o projeto e todas as suas tarefas. Essa ação não pode ser desfeita."
          onConfirm={() => { deleteProject(confirmDelete.id); setConfirmDelete(null); }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
