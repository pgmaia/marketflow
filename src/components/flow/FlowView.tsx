import { useState } from 'react';
import {
  Plus, GitBranch, Trash2, Clock, ArrowRight, Layers,
  ChevronRight, FileText, FolderKanban, Building2, CheckCircle2,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { FlowCanvas } from './FlowCanvas';
import type { FlowBoard, FlowNode, FlowEdge, FlowNodeTask, Project, Task, ProjectPhase } from '../../types';

// ─── Color palette for auto-assigning phase colors ───────────────────────────

const PHASE_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#22c55e', '#14b8a6', '#3b82f6',
];

// ─── Create result discriminated union ────────────────────────────────────────

type CreateResult =
  | { type: 'flow'; board: FlowBoard }
  | { type: 'project'; project: Project; tasks: Task[] };

type ModalMode = 'blank' | 'template';
type SaveType = 'flow' | 'project';

// ─── New board modal ──────────────────────────────────────────────────────────

function NewBoardModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (result: CreateResult) => void;
}) {
  const { templates, companies } = useAppStore();
  const [mode, setMode] = useState<ModalMode>('blank');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [saveType, setSaveType] = useState<SaveType>('flow');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  // ── Build nodes from template (shared between both save paths) ──────────────
  const buildNodesFromTemplate = (templateId: string, ts: number): { nodes: FlowNode[]; edges: FlowEdge[] } => {
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) return { nodes: [], edges: [] };

    const seenPhases: string[] = [];
    for (const t of tpl.tasks) {
      if (!seenPhases.includes(t.phase)) seenPhases.push(t.phase);
    }

    const NODE_W = 220;
    const NODE_GAP = 60;

    const nodes: FlowNode[] = seenPhases.map((phase, i) => {
      const phaseTasks = tpl.tasks.filter(t => t.phase === phase);
      const tasks: FlowNodeTask[] = phaseTasks.map((t, ti) => ({
        id: `fnt-${ts}-${i}-${ti}`,
        title: t.title,
        type: t.type,
      }));
      return {
        id: `fn-${ts}-${i}`,
        type: 'stage' as const,
        x: 60 + i * (NODE_W + NODE_GAP),
        y: 80,
        width: NODE_W,
        color: PHASE_COLORS[i % PHASE_COLORS.length],
        title: phase,
        tasks,
      };
    });

    const edges: FlowEdge[] = nodes.slice(0, -1).map((n, i) => ({
      id: `e-${ts}-${i}`,
      fromId: n.id,
      toId: nodes[i + 1].id,
    }));

    return { nodes, edges };
  };

  const handleCreate = () => {
    const now = new Date().toISOString().split('T')[0];
    const ts = Date.now();
    const id = `flow-${ts}`;

    // ── Resolve name, description, nodes, edges ─────────────────────────────
    let nodes: FlowNode[] = [];
    let edges: FlowEdge[] = [];

    if (mode === 'blank') {
      if (!name.trim()) return;
    } else {
      if (!selectedTemplate) return;
      const built = buildNodesFromTemplate(selectedTemplate.id, ts);
      nodes = built.nodes;
      edges = built.edges;
    }

    const boardName = mode === 'blank' ? name.trim() : (name.trim() || selectedTemplate!.name);
    const boardDesc = mode === 'blank' ? description.trim() : (description.trim() || selectedTemplate!.description || '');

    // ── Save as Flow ─────────────────────────────────────────────────────────
    if (saveType === 'flow') {
      onCreate({
        type: 'flow',
        board: { id, name: boardName, description: boardDesc, nodes, edges, createdAt: now },
      });
      return;
    }

    // ── Save as Project ──────────────────────────────────────────────────────
    if (!selectedCompanyId) return;

    const projectId = `proj-${ts}`;

    // Each node → a phase
    const phases: ProjectPhase[] = nodes.length
      ? nodes.map((n, i) => ({ id: `ph-${ts}-${i}`, name: n.title }))
      : [{ id: `ph-${ts}`, name: 'Tarefas' }];

    const endDate = new Date(ts + 90 * 86400000).toISOString().split('T')[0];

    const project: Project = {
      id: projectId,
      companyId: selectedCompanyId,
      name: boardName,
      description: boardDesc,
      startDate: now,
      endDate,
      teamMemberIds: [],
      color: nodes[0]?.color ?? '#FF5C35',
      phases,
    };

    // Each node task → a Task
    const taskDue = new Date(ts + 30 * 86400000).toISOString().split('T')[0];
    const tasks: Task[] = nodes.flatMap((n, ni) =>
      n.tasks.map((ft, ti) => ({
        id: `t-${ts}-${ni}-${ti}`,
        projectId,
        phase: n.title,
        title: ft.title,
        type: ft.type ?? 'Copy',
        status: 'Not Started' as const,
        priority: 'Medium' as const,
        dueDate: taskDue,
        createdAt: now,
      }))
    );

    onCreate({ type: 'project', project, tasks });
  };

  const canSubmit =
    (mode === 'blank' ? !!name.trim() : !!selectedTemplateId) &&
    (saveType === 'flow' || !!selectedCompanyId);

  const modalWidth = mode === 'template' ? 620 : 460;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ width: modalWidth, maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 shrink-0">
          <h2 className="text-[16px] font-bold text-[#111] mb-4">Novo fluxo</h2>

          {/* Mode tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
            {([
              { key: 'blank' as ModalMode, label: 'Em branco', icon: <GitBranch size={13} /> },
              { key: 'template' as ModalMode, label: 'De template', icon: <Layers size={13} /> },
            ]).map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                  mode === key ? 'bg-white text-[#111] shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-2 flex-1 overflow-y-auto">
          {mode === 'template' && (
            <div className="mb-4">
              {templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <FileText size={28} className="text-gray-200 mb-3" />
                  <p className="text-[13px] font-medium text-gray-400">Nenhum template salvo ainda</p>
                  <p className="text-[12px] text-gray-300 mt-1">Salve tarefas como template em qualquer projeto para usar aqui</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Escolha um template</p>
                  {templates.map(tpl => {
                    const phases = [...new Set(tpl.tasks.map(t => t.phase))];
                    const isSelected = selectedTemplateId === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        onClick={() => {
                          setSelectedTemplateId(tpl.id);
                          if (!name.trim()) setName(tpl.name);
                        }}
                        className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
                          isSelected
                            ? 'border-[#FF5C35] bg-[#FF5C35]/5'
                            : 'border-gray-100 hover:border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] font-semibold truncate ${isSelected ? 'text-[#FF5C35]' : 'text-[#111]'}`}>
                              {tpl.name}
                            </p>
                            {tpl.description && (
                              <p className="text-[12px] text-gray-400 mt-0.5 truncate">{tpl.description}</p>
                            )}
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              {phases.map((ph, i) => (
                                <span key={ph} className="flex items-center gap-1">
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold text-white"
                                    style={{ backgroundColor: PHASE_COLORS[i % PHASE_COLORS.length] }}
                                  >
                                    {ph}
                                  </span>
                                  {i < phases.length - 1 && <ChevronRight size={10} className="text-gray-300" />}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[11px] text-gray-400">{tpl.tasks.length} tarefas</span>
                            <br />
                            <span className="text-[11px] text-gray-300">{phases.length} fases</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Name + description */}
          <div className="space-y-3 mb-5">
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                {mode === 'template' ? 'Nome (opcional)' : 'Nome'}
              </label>
              <input
                autoFocus={mode === 'blank'}
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canSubmit) handleCreate(); if (e.key === 'Escape') onClose(); }}
                placeholder={mode === 'template' ? selectedTemplate?.name ?? 'Usar nome do template' : 'Ex: Funil de Produto Digital'}
                className="mt-1 w-full text-[14px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#FF5C35] transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Descrição (opcional)</label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Descreva o objetivo..."
                className="mt-1 w-full text-[14px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#FF5C35] transition-colors"
              />
            </div>
          </div>

          {/* ── Save type selector ───────────────────────────────────────────── */}
          <div className="border-t border-gray-100 pt-5">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Salvar como</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Flow option */}
              <button
                onClick={() => setSaveType('flow')}
                className={`relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all ${
                  saveType === 'flow'
                    ? 'border-[#FF5C35] bg-[#FF5C35]/5'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                {saveType === 'flow' && (
                  <CheckCircle2 size={14} className="absolute top-3 right-3 text-[#FF5C35]" />
                )}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  saveType === 'flow' ? 'bg-[#FF5C35]/15' : 'bg-gray-100'
                }`}>
                  <GitBranch size={15} className={saveType === 'flow' ? 'text-[#FF5C35]' : 'text-gray-400'} />
                </div>
                <div>
                  <p className={`text-[13px] font-bold leading-tight ${saveType === 'flow' ? 'text-[#FF5C35]' : 'text-gray-700'}`}>
                    Fluxo
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                    Visualize e edite no canvas
                  </p>
                </div>
              </button>

              {/* Project option */}
              <button
                onClick={() => setSaveType('project')}
                className={`relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all ${
                  saveType === 'project'
                    ? 'border-[#FF5C35] bg-[#FF5C35]/5'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                {saveType === 'project' && (
                  <CheckCircle2 size={14} className="absolute top-3 right-3 text-[#FF5C35]" />
                )}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  saveType === 'project' ? 'bg-[#FF5C35]/15' : 'bg-gray-100'
                }`}>
                  <FolderKanban size={15} className={saveType === 'project' ? 'text-[#FF5C35]' : 'text-gray-400'} />
                </div>
                <div>
                  <p className={`text-[13px] font-bold leading-tight ${saveType === 'project' ? 'text-[#FF5C35]' : 'text-gray-700'}`}>
                    Projeto
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                    Com fases, tarefas e equipe
                  </p>
                </div>
              </button>
            </div>

            {/* Company selector — shown only when project is selected */}
            {saveType === 'project' && (
              <div className="mt-4">
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={11} />
                  Empresa
                </label>
                {companies.length === 0 ? (
                  <p className="mt-2 text-[12px] text-gray-400 bg-gray-50 rounded-xl px-3 py-3">
                    Nenhuma empresa cadastrada ainda.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {companies.map(c => {
                      const isSelected = selectedCompanyId === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setSelectedCompanyId(c.id)}
                          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border-2 text-left transition-all ${
                            isSelected
                              ? 'border-[#FF5C35] bg-[#FF5C35]/5'
                              : 'border-gray-100 hover:border-gray-200'
                          }`}
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                            style={{ backgroundColor: c.color }}
                          >
                            {c.logo}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] font-semibold truncate ${isSelected ? 'text-[#FF5C35]' : 'text-[#111]'}`}>
                              {c.name}
                            </p>
                            <p className="text-[11px] text-gray-400 truncate">{c.industry}</p>
                          </div>
                          {isSelected && <CheckCircle2 size={14} className="text-[#FF5C35] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-2 shrink-0">
          <button
            onClick={handleCreate}
            disabled={!canSubmit}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40 transition-colors"
            style={{ backgroundColor: '#FF5C35' }}
          >
            {saveType === 'project'
              ? 'Criar projeto'
              : mode === 'template'
              ? 'Gerar fluxo'
              : 'Criar fluxo'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-[13px] text-gray-500 hover:bg-gray-100 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Board card ───────────────────────────────────────────────────────────────

function FlowBoardCard({ board, onOpen, onDelete }: { board: FlowBoard; onOpen: () => void; onDelete: () => void }) {
  const totalTasks = board.nodes.reduce((sum, n) => sum + n.tasks.length, 0);

  return (
    <div
      className="group relative border border-gray-100 rounded-2xl p-5 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer bg-white"
      onClick={onOpen}
    >
      {/* Mini node preview */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {board.nodes.slice(0, 8).map(n => (
          <div
            key={n.id}
            className="h-6 rounded-lg flex items-center px-2"
            style={{ backgroundColor: n.color, minWidth: 24 }}
          >
            <span className="text-[9px] font-bold text-white truncate max-w-[64px]">{n.title}</span>
          </div>
        ))}
        {board.nodes.length === 0 && (
          <div className="w-full h-12 rounded-xl bg-gray-50 flex items-center justify-center">
            <GitBranch size={16} className="text-gray-200" />
          </div>
        )}
        {board.nodes.length > 8 && (
          <div className="h-6 px-2 rounded-lg bg-gray-100 flex items-center">
            <span className="text-[9px] font-bold text-gray-400">+{board.nodes.length - 8}</span>
          </div>
        )}
      </div>

      <h3 className="text-[14px] font-bold text-[#111] mb-1 truncate">{board.name}</h3>
      {board.description && (
        <p className="text-[12px] text-gray-400 truncate mb-3">{board.description}</p>
      )}

      <div className="flex items-center gap-3 text-[11px] text-gray-400">
        <span>{board.nodes.length} etapas</span>
        <span>·</span>
        <span>{totalTasks} tarefas</span>
        <div className="flex-1" />
        <span className="flex items-center gap-1">
          <Clock size={10} />
          {board.createdAt}
        </span>
      </div>

      {/* Arrow */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowRight size={16} className="text-gray-400" />
      </div>

      {/* Delete */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-400 text-gray-300 transition-all"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function FlowView() {
  const {
    flows, activeFlowId, setActiveFlow, addFlow, deleteFlow,
    addProject, addTask, setActiveProject,
  } = useAppStore();
  const [showNew, setShowNew] = useState(false);
  const [pendingDeleteBoard, setPendingDeleteBoard] = useState<FlowBoard | null>(null);

  if (activeFlowId) {
    return <FlowCanvas boardId={activeFlowId} />;
  }

  const handleCreate = (result: CreateResult) => {
    if (result.type === 'flow') {
      addFlow(result.board);
      setActiveFlow(result.board.id);
    } else {
      addProject(result.project);
      result.tasks.forEach(t => addTask(t));
      setActiveProject(result.project.id);
    }
    setShowNew(false);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-bold text-[#111] tracking-tight">Fluxos de trabalho</h1>
          <p className="text-[13px] text-gray-400 mt-1">Desenhe funis e fluxos de marketing, depois gere projetos com tarefas</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: '#FF5C35' }}
        >
          <Plus size={15} />
          Novo fluxo
        </button>
      </div>

      {/* Board grid */}
      {flows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <GitBranch size={40} className="text-gray-200 mb-4" />
          <p className="text-[15px] font-medium text-gray-400">Nenhum fluxo criado ainda</p>
          <p className="text-[13px] text-gray-300 mt-1">Crie seu primeiro fluxo de trabalho</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {flows.map(board => (
            <FlowBoardCard
              key={board.id}
              board={board}
              onOpen={() => setActiveFlow(board.id)}
              onDelete={() => setPendingDeleteBoard(board)}
            />
          ))}
        </div>
      )}

      {showNew && <NewBoardModal onClose={() => setShowNew(false)} onCreate={handleCreate} />}

      {pendingDeleteBoard && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setPendingDeleteBoard(null)}>
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ width: 380 }} onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  <Trash2 size={16} className="text-red-500" />
                </div>
                <h2 className="text-[15px] font-bold text-gray-900">Apagar "{pendingDeleteBoard.name}"?</h2>
              </div>
              <p className="text-[13px] text-gray-500 leading-relaxed">
                Isso apagará permanentemente este fluxo com <strong>{pendingDeleteBoard.nodes.length}</strong> {pendingDeleteBoard.nodes.length === 1 ? 'etapa' : 'etapas'} e{' '}
                <strong>{pendingDeleteBoard.nodes.reduce((s, n) => s + n.tasks.length, 0)}</strong> tarefas. Essa ação não pode ser desfeita.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
              <button
                onClick={() => { deleteFlow(pendingDeleteBoard.id); setPendingDeleteBoard(null); }}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Sim, apagar
              </button>
              <button onClick={() => setPendingDeleteBoard(null)} className="px-4 py-2.5 rounded-xl text-[13px] text-gray-500 hover:bg-gray-100 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
