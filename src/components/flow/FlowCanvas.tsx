import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, ZoomIn, ZoomOut, Maximize2, Trash2, ArrowLeft, X, Check, Layers, FolderKanban, Building2, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { FlowNode, FlowEdge, FlowNodeTask, FlowNodeType, FlowBoard, Project, Task, ProjectPhase } from '../../types';

// ─── Constants ───────────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  '#6366f1': 'Índigo',
  '#8b5cf6': 'Violeta',
  '#ec4899': 'Rosa',
  '#ef4444': 'Vermelho',
  '#f59e0b': 'Âmbar',
  '#22c55e': 'Verde',
  '#14b8a6': 'Teal',
  '#3b82f6': 'Azul',
  '#64748b': 'Slate',
  '#111827': 'Preto',
};

const TEMPLATE_PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#22c55e', '#14b8a6', '#3b82f6',
];

const NODE_DEFAULTS: Record<FlowNodeType, { width: number; title: string; color: string }> = {
  stage:    { width: 220, title: 'Nova Etapa',  color: '#6366f1' },
  action:   { width: 180, title: 'Nova Ação',   color: '#f59e0b' },
  note:     { width: 180, title: 'Nota',        color: '#64748b' },
  decision: { width: 160, title: 'Decisão?',    color: '#111827' },
};

// ─── Edge renderer ────────────────────────────────────────────────────────────

function EdgeLine({ edge, nodes, onDelete }: { edge: FlowEdge; nodes: FlowNode[]; onDelete: () => void }) {
  const from = nodes.find(n => n.id === edge.fromId);
  const to   = nodes.find(n => n.id === edge.toId);
  if (!from || !to) return null;

  // Estimate node heights based on tasks
  const fromH = 52 + from.tasks.length * 32 + 44;
  const toH   = 52 + to.tasks.length * 32 + 44;

  const sx = from.x + from.width;
  const sy = from.y + fromH / 2;
  const tx = to.x;
  const ty = to.y + toH / 2;
  const gap = tx - sx;
  const bend = Math.max(40, Math.abs(gap) * 0.45);
  const cx1 = sx + bend;
  const cy1 = sy;
  const cx2 = tx - bend;
  const cy2 = ty;

  const midX = (sx + tx) / 2;
  const midY = (sy + ty) / 2;

  const [hovered, setHovered] = useState(false);

  return (
    <g>
      {/* Invisible wider path for hover detection */}
      <path
        d={`M ${sx} ${sy} C ${cx1} ${cy1} ${cx2} ${cy2} ${tx} ${ty}`}
        fill="none" stroke="transparent" strokeWidth={12}
        className="cursor-pointer"
        style={{ pointerEvents: 'stroke' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {/* Visible edge */}
      <path
        d={`M ${sx} ${sy} C ${cx1} ${cy1} ${cx2} ${cy2} ${tx} ${ty}`}
        fill="none"
        stroke={hovered ? '#1f6feb' : '#9ca3af'}
        strokeWidth={hovered ? 2.5 : 2}
        markerEnd={hovered ? 'url(#arrowhead-hover)' : 'url(#arrowhead)'}
        style={{ pointerEvents: 'none', transition: 'stroke 0.15s, stroke-width 0.15s' }}
      />
      {/* Delete button on hover */}
      {hovered && (
        <g
          transform={`translate(${midX - 10}, ${midY - 10})`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="cursor-pointer"
          onMouseDown={e => e.stopPropagation()}
          onClick={onDelete}
          style={{ pointerEvents: 'all' }}
        >
          <circle cx={10} cy={10} r={10} fill="white" stroke="#d1d5db" strokeWidth={1} />
          <line x1={6} y1={6} x2={14} y2={14} stroke="#ef4444" strokeWidth={1.5} strokeLinecap="round" />
          <line x1={14} y1={6} x2={6} y2={14} stroke="#ef4444" strokeWidth={1.5} strokeLinecap="round" />
        </g>
      )}
    </g>
  );
}

// ─── Node component ───────────────────────────────────────────────────────────

function FlowNodeCard({
  node,
  flowId,
  selected,
  connecting,
  onSelect,
  onDragStart,
  onConnectFrom,
  onConnectTo,
  onSaveAsTemplate,
  onDeleteRequest,
}: {
  node: FlowNode;
  flowId: string;
  selected: boolean;
  connecting: boolean;
  onSelect: () => void;
  onDragStart: (e: React.MouseEvent, offsetX: number, offsetY: number) => void;
  onConnectFrom: (e: React.MouseEvent) => void;
  onConnectTo: () => void;
  onSaveAsTemplate: () => void;
  onDeleteRequest: () => void;
}) {
  const { updateFlowNode, addFlowNodeTask, deleteFlowNodeTask } = useAppStore();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(node.title);
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [hovered, setHovered] = useState(false);

  const nodeHeight = 52 + node.tasks.length * 32 + 44;

  const handleTitleSave = () => {
    if (titleVal.trim()) updateFlowNode(flowId, node.id, { title: titleVal.trim() });
    else setTitleVal(node.title);
    setEditingTitle(false);
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    const task: FlowNodeTask = { id: `fnt${Date.now()}`, title: newTaskTitle.trim() };
    addFlowNodeTask(flowId, node.id, task);
    setNewTaskTitle('');
    setAddingTask(false);
  };

  return (
    <div
      className="absolute select-none"
      style={{ left: node.x, top: node.y, width: node.width }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Main card */}
      <div
        className={`rounded-xl overflow-hidden border-2 transition-all bg-white ${
          selected ? 'border-[#1f6feb] shadow-lg shadow-[#1f6feb]/10' :
          connecting ? 'border-transparent hover:border-blue-400 cursor-crosshair' :
          'border-transparent hover:border-gray-200'
        }`}
        style={{ boxShadow: selected ? undefined : '0 2px 12px rgba(0,0,0,0.08)' }}
        onClick={e => {
          e.stopPropagation();
          if (connecting) { onConnectTo(); return; }
          onSelect();
        }}
      >
        {/* Colored header */}
        <div
          className="px-3 py-2.5 flex items-center gap-2"
          style={{ backgroundColor: node.color }}
          onMouseDown={e => {
            e.stopPropagation();
            if (connecting) return;
            const rect = (e.currentTarget.closest('.absolute') as HTMLElement)?.getBoundingClientRect();
            if (!rect) return;
            onDragStart(e, e.clientX - rect.left, e.clientY - rect.top);
          }}
        >
          {editingTitle ? (
            <input
              autoFocus
              value={titleVal}
              onChange={e => setTitleVal(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') { setTitleVal(node.title); setEditingTitle(false); } }}
              onClick={e => e.stopPropagation()}
              className="flex-1 bg-white/20 text-white placeholder-white/60 text-[13px] font-bold rounded px-1 outline-none border border-white/40"
            />
          ) : (
            <span
              className="flex-1 text-[13px] font-bold text-white truncate cursor-text"
              onDoubleClick={e => { e.stopPropagation(); setEditingTitle(true); }}
            >
              {node.title}
            </span>
          )}
          {/* Color picker toggle */}
          {selected && (
            <div className="relative">
              <button
                onClick={e => { e.stopPropagation(); setShowColorPicker(v => !v); }}
                className="w-4 h-4 rounded-full border-2 border-white/60 shrink-0"
                style={{ backgroundColor: node.color }}
              />
              {showColorPicker && (
                <div
                  className="absolute top-full right-0 mt-1 bg-white rounded-xl p-2 z-50 flex flex-wrap gap-1.5"
                  style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.15)', width: '130px' }}
                  onClick={e => e.stopPropagation()}
                >
                  {Object.keys(NODE_COLORS).map(c => (
                    <button
                      key={c}
                      onClick={() => { updateFlowNode(flowId, node.id, { color: c }); setShowColorPicker(false); }}
                      className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: c, borderColor: node.color === c ? '#1f6feb' : 'transparent' }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tasks list */}
        <div className="bg-white">
          {node.tasks.map(task => (
            <div
              key={task.id}
              className="flex items-center gap-2 px-3 py-2 border-b border-gray-50 group/task hover:bg-gray-50 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-gray-300" />
              <span className="flex-1 text-[12px] text-gray-700 truncate">{task.title}</span>
              <button
                onClick={e => { e.stopPropagation(); deleteFlowNodeTask(flowId, node.id, task.id); }}
                className="opacity-0 group-hover/task:opacity-100 text-gray-300 hover:text-red-400 transition-all"
              >
                <X size={11} />
              </button>
            </div>
          ))}

          {/* Add task */}
          <div className="px-3 py-2">
            {addingTask ? (
              <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                <input
                  autoFocus
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddTask(); if (e.key === 'Escape') { setAddingTask(false); setNewTaskTitle(''); } }}
                  placeholder="Nome da tarefa..."
                  className="flex-1 text-[12px] text-gray-700 bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:border-blue-300"
                />
                <button onClick={handleAddTask} className="w-6 h-6 flex items-center justify-center rounded bg-green-500 text-white shrink-0">
                  <Check size={11} />
                </button>
                <button onClick={() => { setAddingTask(false); setNewTaskTitle(''); }} className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 text-gray-400 shrink-0">
                  <X size={11} />
                </button>
              </div>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); setAddingTask(true); }}
                className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Plus size={11} />
                Adicionar tarefa
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Connection handle — shown on hover or when selected */}
      {(hovered || selected) && !connecting && (
        <>
          {/* Right handle */}
          <div
            className="absolute w-4 h-4 rounded-full bg-white border-2 border-gray-300 hover:border-[#1f6feb] hover:bg-[#1f6feb] cursor-crosshair transition-colors flex items-center justify-center"
            style={{ right: -8, top: nodeHeight / 2 - 8 }}
            onMouseDown={e => { e.stopPropagation(); onConnectFrom(e); }}
          />
        </>
      )}

      {/* Actions — shown when selected */}
      {selected && (
        <>
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onDeleteRequest(); }}
            className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
          >
            <Trash2 size={11} />
          </button>
          {/* Save as template button — below the card */}
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onSaveAsTemplate(); }}
            className="absolute -bottom-8 left-0 right-0 mx-auto w-fit flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-[11px] font-semibold text-gray-600 hover:border-[#1f6feb] hover:text-[#1f6feb] transition-colors shadow-sm whitespace-nowrap"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
          >
            <Layers size={10} />
            Salvar como template
          </button>
        </>
      )}
    </div>
  );
}

// ─── Preview edge (while connecting) ─────────────────────────────────────────

function PreviewEdge({ fromId, toPos, nodes }: { fromId: string; toPos: { x: number; y: number }; nodes: FlowNode[] }) {
  const from = nodes.find(n => n.id === fromId);
  if (!from) return null;
  const fromH = 52 + from.tasks.length * 32 + 44;
  const sx = from.x + from.width;
  const sy = from.y + fromH / 2;
  const tx = toPos.x;
  const ty = toPos.y;
  const bend = Math.max(40, Math.abs(tx - sx) * 0.45);
  const cx1 = sx + bend;
  const cy1 = sy;
  const cx2 = tx - bend;
  const cy2 = ty;
  return (
    <path
      d={`M ${sx} ${sy} C ${cx1} ${cy1} ${cx2} ${cy2} ${tx} ${ty}`}
      fill="none" stroke="#1f6feb" strokeWidth={2} strokeDasharray="6,4"
      markerEnd="url(#arrowhead-preview)"
      style={{ pointerEvents: 'none' }}
    />
  );
}

// ─── Save as Project modal ────────────────────────────────────────────────────

function SaveAsProjectModal({ board, onClose }: { board: FlowBoard; onClose: () => void }) {
  const { companies, teams, addProject, addTask, setActiveProject } = useAppStore();
  const [projectName, setProjectName] = useState(board.name);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  const canSave = projectName.trim() && selectedCompanyId;

  const handleSave = () => {
    if (!canSave) return;
    const now = new Date().toISOString().split('T')[0];
    const ts = Date.now();
    const projectId = `proj-${ts}`;

    const phases: ProjectPhase[] = board.nodes.length
      ? board.nodes.map((n, i) => ({ id: `ph-${ts}-${i}`, name: n.title }))
      : [{ id: `ph-${ts}`, name: 'Tarefas' }];

    const teamMemberIds = [...new Set(
      teams
        .filter(t => t.companyId === selectedCompanyId)
        .flatMap(t => t.memberIds)
    )];

    const project: Project = {
      id: projectId,
      companyId: selectedCompanyId,
      name: projectName.trim(),
      description: board.description ?? '',
      startDate: now,
      endDate: new Date(ts + 90 * 86400000).toISOString().split('T')[0],
      teamMemberIds,
      color: board.nodes[0]?.color ?? '#1f6feb',
      phases,
    };

    const taskDue = new Date(ts + 30 * 86400000).toISOString().split('T')[0];
    const tasks: Task[] = board.nodes.flatMap((n, ni) =>
      n.tasks.map((ft, ti) => ({
        id: `t-${ts}-${ni}-${ti}`,
        projectId,
        phase: n.title,
        title: ft.title,
        type: ft.type ?? 'Copy',
        status: 'Backlog' as const,
        priority: 'Medium' as const,
        dueDate: taskDue,
        createdAt: now,
      }))
    );

    addProject(project);
    tasks.forEach(t => addTask(t));
    setActiveProject(projectId);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 420, maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#1f6feb]/10 flex items-center justify-center">
              <FolderKanban size={15} className="text-[#1f6feb]" />
            </div>
            <h2 className="text-[15px] font-bold text-[#111]">Salvar como projeto</h2>
          </div>
          <p className="text-[12px] text-gray-400 ml-11">
            As etapas do fluxo virarão fases e as tarefas serão importadas automaticamente.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex-1 overflow-y-auto space-y-5">
          {/* Project name */}
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Nome do projeto</label>
            <input
              autoFocus
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canSave) handleSave(); if (e.key === 'Escape') onClose(); }}
              className="mt-1.5 w-full text-[14px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#1f6feb] transition-colors"
            />
          </div>

          {/* Flow summary */}
          {board.nodes.length > 0 && (
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">O que será importado</p>
              <div className="space-y-1.5">
                {board.nodes.map(n => (
                  <div key={n.id} className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: n.color }} />
                    <span className="text-[12px] text-gray-700 font-medium truncate">{n.title}</span>
                    {n.tasks.length > 0 && (
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {n.tasks.length} {n.tasks.length === 1 ? 'tarefa' : 'tarefas'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Company selector */}
          <div>
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
                        isSelected ? 'border-[#1f6feb] bg-[#1f6feb]/5' : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                        style={{ backgroundColor: c.color }}
                      >
                        {c.logo}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] font-semibold truncate ${isSelected ? 'text-[#1f6feb]' : 'text-[#111]'}`}>{c.name}</p>
                        <p className="text-[11px] text-gray-400 truncate">{c.industry}</p>
                      </div>
                      {isSelected && <CheckCircle2 size={14} className="text-[#1f6feb] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-2 shrink-0">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: '#1f6feb' }}
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

// ─── Main canvas ──────────────────────────────────────────────────────────────

export function FlowCanvas({ boardId }: { boardId: string }) {
  const { flows, templates, addFlowNode, addFlowEdge, deleteFlowEdge, deleteFlowNode, addTemplate } = useAppStore();
  const board = flows.find(f => f.id === boardId);

  const [pan, setPan] = useState({ x: 60, y: 60 });
  const [zoom, setZoom] = useState(0.9);
  const [dragging, setDragging] = useState<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [mouseCanvas, setMouseCanvas] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [showSaveAsProject, setShowSaveAsProject] = useState(false);
  const [pendingDeleteNodeId, setPendingDeleteNodeId] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const updateFlowNodePos = useAppStore(s => s.updateFlowNode);

  const toCanvas = useCallback((screenX: number, screenY: number) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (screenX - rect.left - pan.x) / zoom,
      y: (screenY - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);

  // Keyboard events
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target as HTMLElement).matches('input,textarea')) {
        e.preventDefault();
        setSpaceHeld(true);
      }
      if (e.code === 'Escape') {
        setConnectingFrom(null);
        setSelectedId(null);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, []);

  const handleWrapperMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || spaceHeld) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y });
      return;
    }
    // Click on canvas bg = deselect
    setSelectedId(null);
    setConnectingFrom(null);
  };

  const handleWrapperMouseMove = (e: React.MouseEvent) => {
    const pos = toCanvas(e.clientX, e.clientY);
    setMouseCanvas(pos);

    if (isPanning) {
      setPan({
        x: panStart.panX + (e.clientX - panStart.x),
        y: panStart.panY + (e.clientY - panStart.y),
      });
      return;
    }

    if (dragging && board) {
      const canvasPos = toCanvas(e.clientX, e.clientY);
      updateFlowNodePos(boardId, dragging.nodeId, {
        x: canvasPos.x - dragging.offsetX,
        y: canvasPos.y - dragging.offsetY,
      });
    }
  };

  const handleWrapperMouseUp = () => {
    setIsPanning(false);
    setDragging(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(3, Math.max(0.2, zoom * factor));
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const canvasX = (mouseX - pan.x) / zoom;
    const canvasY = (mouseY - pan.y) / zoom;
    setPan({
      x: mouseX - canvasX * newZoom,
      y: mouseY - canvasY * newZoom,
    });
    setZoom(newZoom);
  };

  const handleAddNode = (type: FlowNodeType) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    const defaults = NODE_DEFAULTS[type];
    // Place in center of viewport
    const cx = rect ? (rect.width / 2 - pan.x) / zoom - defaults.width / 2 : 100;
    const cy = rect ? (rect.height / 2 - pan.y) / zoom - 80 : 100;
    const node: FlowNode = {
      id: `fn${Date.now()}`,
      type,
      x: cx,
      y: cy,
      width: defaults.width,
      title: defaults.title,
      color: defaults.color,
      tasks: [],
    };
    addFlowNode(boardId, node);
    setSelectedId(node.id);
  };

  const handleAddFromTemplate = (tpl: { id: string; name: string; tasks: Array<{ title: string; type?: string }> }) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    const w = 220;
    // Offset each new node slightly so they don't stack
    const cx = rect ? (rect.width / 2 - pan.x) / zoom - w / 2 + (board?.nodes.length ?? 0) * 20 : 100;
    const cy = rect ? (rect.height / 2 - pan.y) / zoom - 80 + (board?.nodes.length ?? 0) * 20 : 100;
    const tplIndex = templates.findIndex(t => t.id === tpl.id);
    const color = TEMPLATE_PALETTE[tplIndex % TEMPLATE_PALETTE.length];
    const node: FlowNode = {
      id: `fn${Date.now()}`,
      type: 'stage',
      x: cx,
      y: cy,
      width: w,
      title: tpl.name,
      color,
      tasks: tpl.tasks.map((t, i) => ({
        id: `fnt${Date.now()}-${i}`,
        title: t.title,
        type: t.type as FlowNode['tasks'][number]['type'],
      })),
    };
    addFlowNode(boardId, node);
    setSelectedId(node.id);
  };

  const handleSaveNodeAsTemplate = (node: FlowNode) => {
    const already = templates.find(t => t.name === node.title);
    addTemplate({
      id: `tpl-${Date.now()}`,
      name: node.title,
      description: node.description ?? `Template gerado do fluxo: ${board?.name ?? ''}`,
      tasks: node.tasks.map(t => ({
        title: t.title,
        type: t.type ?? 'Copy',
        phase: node.title,
        priority: 'Medium' as const,
      })),
      createdAt: new Date().toISOString().split('T')[0],
    });
    // Visual feedback — brief flash on the node (handled via toast or just let it save silently)
    if (already) {
      // Update existing instead of duplicate — handled by the store deduplication is not built in,
      // so we just add; user can manage in the template list
    }
  };

  const handleConnectTo = (targetId: string) => {
    if (!connectingFrom || connectingFrom === targetId) { setConnectingFrom(null); return; }
    // Avoid duplicate edges
    const exists = board?.edges.some(e => e.fromId === connectingFrom && e.toId === targetId);
    if (!exists) {
      addFlowEdge(boardId, { id: `e${Date.now()}`, fromId: connectingFrom, toId: targetId });
    }
    setConnectingFrom(null);
  };

  const fitView = () => {
    if (!board || board.nodes.length === 0) return;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const minX = Math.min(...board.nodes.map(n => n.x));
    const minY = Math.min(...board.nodes.map(n => n.y));
    const maxX = Math.max(...board.nodes.map(n => n.x + n.width));
    const maxY = Math.max(...board.nodes.map(n => { const h = 52 + n.tasks.length * 32 + 44; return n.y + h; }));
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const newZoom = Math.min(0.95, Math.min((rect.width - 120) / contentW, (rect.height - 120) / contentH));
    const newPanX = (rect.width - contentW * newZoom) / 2 - minX * newZoom;
    const newPanY = (rect.height - contentH * newZoom) / 2 - minY * newZoom;
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  if (!board) return null;

  // Canvas size for SVG (large enough)
  const svgW = 8000;
  const svgH = 6000;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[#E5E7EB] shrink-0">
        <button
          onClick={() => useAppStore.setState({ activeFlowId: null })}
          className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={14} />
          Fluxos
        </button>
        <span className="text-gray-200">/</span>
        <span className="text-[13px] font-semibold text-[#111]">{board.name}</span>

        <div className="flex-1" />

        {connectingFrom && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[12px] text-blue-700 font-medium">Clique em outro bloco para conectar · Esc para cancelar</span>
          </div>
        )}

        {/* Save as project button */}
        <button
          onClick={() => setShowSaveAsProject(true)}
          className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#1f6feb' }}
        >
          <FolderKanban size={13} />
          Salvar como projeto
        </button>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
          <button onClick={() => setZoom(z => Math.max(0.2, z * 0.85))} className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 text-gray-500 transition-colors">
            <ZoomOut size={13} />
          </button>
          <span className="text-[11px] font-medium text-gray-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z * 1.15))} className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 text-gray-500 transition-colors">
            <ZoomIn size={13} />
          </button>
        </div>
        <button onClick={fitView} className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <Maximize2 size={13} />
        </button>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left toolbar */}
        <div className="w-52 shrink-0 border-r border-[#E5E7EB] flex flex-col bg-white overflow-hidden">
          {/* Block types */}
          <div className="px-3 pt-4 pb-3">
            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-2 px-1">Blocos</p>
            <div className="grid grid-cols-2 gap-1">
              {([
                { type: 'stage' as FlowNodeType, label: 'Etapa', emoji: '📋' },
                { type: 'action' as FlowNodeType, label: 'Ação', emoji: '⚡' },
                { type: 'note' as FlowNodeType, label: 'Nota', emoji: '📝' },
                { type: 'decision' as FlowNodeType, label: 'Decisão', emoji: '❓' },
              ] as const).map(({ type, label, emoji }) => (
                <button
                  key={type}
                  onClick={() => handleAddNode(type)}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left group"
                >
                  <span className="text-[14px] leading-none shrink-0">{emoji}</span>
                  <span className="text-[11px] text-gray-500 group-hover:text-gray-700 font-medium leading-none">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mx-3 border-t border-gray-100" />

          {/* Templates section */}
          <div className="flex flex-col flex-1 min-h-0 px-3 pt-3 pb-3">
            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-2 px-1">Templates</p>
            <div className="flex-1 overflow-y-auto space-y-1">
              {templates.length === 0 ? (
                <p className="text-[11px] text-gray-300 px-1 leading-relaxed">
                  Salve tarefas como template em qualquer projeto para usar aqui
                </p>
              ) : (
                templates.map((tpl, i) => (
                  <button
                    key={tpl.id}
                    onClick={() => handleAddFromTemplate(tpl)}
                    className="w-full text-left px-2.5 py-2.5 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: TEMPLATE_PALETTE[i % TEMPLATE_PALETTE.length] }}
                      />
                      <span className="text-[11px] font-semibold text-gray-700 truncate group-hover:text-gray-900">
                        {tpl.name}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 pl-4">
                      {tpl.tasks.length} {tpl.tasks.length === 1 ? 'tarefa' : 'tarefas'}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={wrapperRef}
          className={`flex-1 relative overflow-hidden ${spaceHeld ? 'cursor-grab' : ''} ${isPanning ? 'cursor-grabbing' : ''}`}
          onMouseDown={handleWrapperMouseDown}
          onMouseMove={handleWrapperMouseMove}
          onMouseUp={handleWrapperMouseUp}
          onMouseLeave={handleWrapperMouseUp}
          onWheel={handleWheel}
          style={{ backgroundColor: '#F8F9FB' }}
        >
          {/* Dot grid background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle, #d1d5db 1px, transparent 1px)`,
              backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
              backgroundPosition: `${pan.x % (24 * zoom)}px ${pan.y % (24 * zoom)}px`,
            }}
          />

          {/* Transform container */}
          <div
            className="absolute"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              width: svgW,
              height: svgH,
            }}
          >
            {/* Nodes */}
            {board.nodes.map(node => (
              <FlowNodeCard
                key={node.id}
                node={node}
                flowId={boardId}
                selected={selectedId === node.id}
                connecting={!!connectingFrom}
                onSelect={() => setSelectedId(node.id)}
                onDragStart={(e, ox, oy) => {
                  e.stopPropagation();
                  setDragging({ nodeId: node.id, offsetX: ox, offsetY: oy });
                  setSelectedId(node.id);
                }}
                onConnectFrom={e => {
                  e.stopPropagation();
                  setConnectingFrom(node.id);
                  setSelectedId(null);
                }}
                onConnectTo={() => handleConnectTo(node.id)}
                onSaveAsTemplate={() => handleSaveNodeAsTemplate(node)}
                onDeleteRequest={() => setPendingDeleteNodeId(node.id)}
              />
            ))}

            {/* SVG edges layer — rendered after nodes so arrows appear on top */}
            <svg
              className="absolute inset-0 overflow-visible"
              width={svgW}
              height={svgH}
              style={{ pointerEvents: 'none', zIndex: 10 }}
            >
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
                </marker>
                <marker id="arrowhead-hover" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#1f6feb" />
                </marker>
                <marker id="arrowhead-preview" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#1f6feb" />
                </marker>
              </defs>
              <g style={{ pointerEvents: 'all' }}>
                {board.edges.map(edge => (
                  <EdgeLine
                    key={edge.id}
                    edge={edge}
                    nodes={board.nodes}
                    onDelete={() => deleteFlowEdge(boardId, edge.id)}
                  />
                ))}
              </g>
              {connectingFrom && (
                <PreviewEdge fromId={connectingFrom} toPos={mouseCanvas} nodes={board.nodes} />
              )}
            </svg>
          </div>

          {/* Zoom hint */}
          <div className="absolute bottom-4 right-4 text-[11px] text-gray-300 select-none pointer-events-none">
            Scroll para zoom · Espaço+drag para mover
          </div>
        </div>
      </div>

      {showSaveAsProject && (
        <SaveAsProjectModal
          board={board}
          onClose={() => setShowSaveAsProject(false)}
        />
      )}

      {pendingDeleteNodeId && (() => {
        const node = board.nodes.find(n => n.id === pendingDeleteNodeId);
        if (!node) return null;
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setPendingDeleteNodeId(null)}>
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ width: 360 }} onClick={e => e.stopPropagation()}>
              <div className="px-6 pt-6 pb-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                    <Trash2 size={16} className="text-red-500" />
                  </div>
                  <h2 className="text-[15px] font-bold text-gray-900">Apagar "{node.title}"?</h2>
                </div>
                <p className="text-[13px] text-gray-500 leading-relaxed">
                  Este bloco e {node.tasks.length > 0 ? <><strong>{node.tasks.length}</strong> {node.tasks.length === 1 ? 'tarefa' : 'tarefas'} serão apagadas</> : 'suas conexões serão removidas'}. Essa ação não pode ser desfeita.
                </p>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
                <button
                  onClick={() => { deleteFlowNode(boardId, pendingDeleteNodeId); setSelectedId(null); setPendingDeleteNodeId(null); }}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
                >
                  Sim, apagar
                </button>
                <button onClick={() => setPendingDeleteNodeId(null)} className="px-4 py-2.5 rounded-xl text-[13px] text-gray-500 hover:bg-gray-100 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
