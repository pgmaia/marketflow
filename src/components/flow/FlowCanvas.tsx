import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, ZoomIn, ZoomOut, Maximize2, Trash2, ArrowLeft, X, Check, Layers, FolderKanban, Building2, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { FlowNode, FlowEdge, FlowNodeTask, FlowNodeType, FlowBoard, FlowLane, Project, Task, ProjectPhase } from '../../types';
import { localISO } from '../../lib/date';

// ─── Constants ───────────────────────────────────────────────────────────────

// Colours cycled through as phase bands are created.
const LANE_PALETTE = ['#1f6feb', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#0ea5e9', '#ec4899'];

// Estimated card height, used by edges/fitView to aim at the card's centre.
// Subtask rows are the same 32px as task rows, so they must be counted — a
// task-only formula would make arrows land above centre on cards with subtasks.
function nodeEstHeight(n: FlowNode): number {
  const rows = n.tasks.reduce((acc, t) => acc + 1 + (t.subtasks?.length ?? 0), 0);
  return 52 + (n.description ? 52 : 32) + rows * 32 + 44;
}

// Connection points on the four sides of a card, each with its outward
// direction — used to route edges and to aim the curve's control points.
type Anchor = { x: number; y: number; dx: number; dy: number };
function nodeAnchors(n: FlowNode): Anchor[] {
  const h = nodeEstHeight(n);
  return [
    { x: n.x + n.width,     y: n.y + h / 2, dx: 1,  dy: 0 },  // right
    { x: n.x,               y: n.y + h / 2, dx: -1, dy: 0 },  // left
    { x: n.x + n.width / 2, y: n.y,         dx: 0,  dy: -1 }, // top
    { x: n.x + n.width / 2, y: n.y + h,     dx: 0,  dy: 1 },  // bottom
  ];
}

// Pick the pair of sides with the shortest distance between the two cards.
// Blocks stacked vertically therefore connect bottom→top on their own — no
// stored direction, so every existing arrow benefits immediately.
function routeEdge(from: FlowNode, to: FlowNode): { a: Anchor; b: Anchor } {
  let best: { a: Anchor; b: Anchor } | null = null;
  let bestD = Infinity;
  for (const a of nodeAnchors(from)) for (const b of nodeAnchors(to)) {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d < bestD) { bestD = d; best = { a, b }; }
  }
  return best!;
}

function edgeGeometry(a: Anchor, b: Anchor): { d: string; midX: number; midY: number } {
  const bend = Math.max(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.45);
  const c1x = a.x + a.dx * bend, c1y = a.y + a.dy * bend;
  const c2x = b.x + b.dx * bend, c2y = b.y + b.dy * bend;
  // The delete button must sit ON the curve. The straight-chord midpoint used
  // before drifts far from a strongly bent Bézier, leaving the X floating in
  // empty canvas. Evaluate the cubic at t = 0.5: (P0 + 3·C1 + 3·C2 + P3) / 8.
  return {
    d: `M ${a.x} ${a.y} C ${c1x} ${c1y} ${c2x} ${c2y} ${b.x} ${b.y}`,
    midX: (a.x + 3 * c1x + 3 * c2x + b.x) / 8,
    midY: (a.y + 3 * c1y + 3 * c2y + b.y) / 8,
  };
}
const LANE_MIN_WIDTH = 160;

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

function EdgeLine({ edge, nodes, onDelete, hovered, emphasized, onHoverStart, onHoverEnd }: {
  edge: FlowEdge;
  nodes: FlowNode[];
  onDelete: () => void;
  /** Pointer is on this edge — canvas lifts it above the cards. */
  hovered: boolean;
  /** One of its endpoint blocks is selected — lifted too, with the delete
   *  button already showing, so even a fully covered arrow can be removed. */
  emphasized: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}) {
  const from = nodes.find(n => n.id === edge.fromId);
  const to   = nodes.find(n => n.id === edge.toId);
  if (!from || !to) return null;

  const { a, b } = routeEdge(from, to);
  const { d, midX, midY } = edgeGeometry(a, b);
  const showDelete = hovered || emphasized;

  return (
    <g>
      {/* Invisible wider path for hover detection */}
      <path
        d={d}
        fill="none" stroke="transparent" strokeWidth={12}
        className="cursor-pointer"
        style={{ pointerEvents: 'stroke' }}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
      />
      {/* Visible edge */}
      <path
        d={d}
        fill="none"
        stroke={hovered ? '#1f6feb' : emphasized ? '#6b7280' : '#9ca3af'}
        strokeWidth={hovered || emphasized ? 2.5 : 2}
        markerEnd={hovered ? 'url(#arrowhead-hover)' : 'url(#arrowhead)'}
        style={{ pointerEvents: 'none', transition: 'stroke 0.15s, stroke-width 0.15s' }}
      />
      {showDelete && (
        <g
          transform={`translate(${midX - 10}, ${midY - 10})`}
          onMouseEnter={onHoverStart}
          onMouseLeave={onHoverEnd}
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
  const { updateFlowNode, addFlowNodeTask, deleteFlowNodeTask, addFlowNodeSubtask, deleteFlowNodeSubtask, renameFlowNodeTask, moveFlowNodeTask, flows, projects, tasks: projectTasks } = useAppStore();

  // On a linked board, every flow task/subtask has a project twin (flowTaskId
  // points back at it). A twin that no longer exists means it was deleted on
  // the project side — the flow copy renders greyed out until it is deleted
  // here too, so a removal is only final once it happened in BOTH views.
  const _board = flows.find(fl => fl.id === flowId);
  const _linkedId = _board?.linkedProjectId && projects.some(p => p.id === _board.linkedProjectId)
    ? _board.linkedProjectId : null;
  const liveTwinIds = _linkedId
    ? new Set(projectTasks.filter(t => t.projectId === _linkedId && t.flowTaskId).map(t => t.flowTaskId as string))
    : null;
  const isGhost = (id: string) => !!liveTwinIds && !liveTwinIds.has(id);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(node.title);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descVal, setDescVal] = useState(node.description ?? '');
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  // Which task is receiving a new subtask right now (one composer at a time).
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  // Inline rename of a task/subtask row (taskId may be either kind of id).
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskVal, setEditingTaskVal] = useState('');
  // Row drag-to-reorder inside this block.
  const dragTaskRef = useRef<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dragOverEnd, setDragOverEnd] = useState(false);

  const handleRowDrop = (targetId: string | null) => {
    const src = dragTaskRef.current;
    dragTaskRef.current = null;
    setDragOverTaskId(null);
    setDragOverEnd(false);
    if (!src || src === targetId) return;
    moveFlowNodeTask(flowId, node.id, src, targetId);
  };

  const commitTaskRename = (taskId: string) => {
    const v = editingTaskVal.trim();
    if (v) renameFlowNodeTask(flowId, node.id, taskId, v);
    setEditingTaskId(null);
  };
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [hovered, setHovered] = useState(false);

  const descHeight = node.description ? 52 : 32;
  const nodeHeight = nodeEstHeight(node);

  const handleDescSave = () => {
    updateFlowNode(flowId, node.id, { description: descVal.trim() });
    setEditingDesc(false);
  };

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

  const handleAddSubtask = (taskId: string) => {
    const t = newSubtaskTitle.trim();
    if (!t) return;
    addFlowNodeSubtask(flowId, node.id, taskId, { id: `fns${Date.now()}`, title: t });
    setNewSubtaskTitle('');
    // keep the composer open — checklists are usually typed in one burst
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
              className="flex-1 text-[13px] font-bold text-white break-words cursor-text leading-snug"
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

        {/* Description */}
        <div className="bg-white border-b border-gray-100 px-3 py-1.5" onClick={e => e.stopPropagation()}>
          {editingDesc ? (
            <textarea
              autoFocus
              value={descVal}
              onChange={e => setDescVal(e.target.value)}
              onBlur={handleDescSave}
              onKeyDown={e => { if (e.key === 'Escape') { setDescVal(node.description ?? ''); setEditingDesc(false); } }}
              rows={2}
              placeholder="Descrição da etapa..."
              className="w-full text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded px-1.5 py-1 outline-none focus:border-blue-300 resize-none"
            />
          ) : (
            <div
              className="cursor-text min-h-[18px]"
              onClick={() => setEditingDesc(true)}
            >
              {node.description ? (
                <p className="text-[11px] text-gray-500 break-words leading-snug">{node.description}</p>
              ) : (
                <p className="text-[11px] text-gray-300 italic">Adicionar descrição...</p>
              )}
            </div>
          )}
        </div>

        {/* Tasks list */}
        <div className="bg-white">
          {node.tasks.map(task => (
            <div key={task.id}>
              <div
                draggable={editingTaskId !== task.id}
                onDragStart={e => {
                  e.stopPropagation();
                  // Firefox won't start a drag without a payload.
                  e.dataTransfer.setData('text/plain', task.id);
                  e.dataTransfer.effectAllowed = 'move';
                  dragTaskRef.current = task.id;
                }}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverTaskId(task.id); }}
                onDragLeave={() => setDragOverTaskId(id => (id === task.id ? null : id))}
                onDrop={e => { e.preventDefault(); e.stopPropagation(); handleRowDrop(task.id); }}
                onDragEnd={() => { dragTaskRef.current = null; setDragOverTaskId(null); setDragOverEnd(false); }}
                className={`flex items-center gap-2 px-3 py-2 border-b border-gray-50 group/task hover:bg-gray-50 transition-colors cursor-grab active:cursor-grabbing ${isGhost(task.id) ? 'opacity-60 grayscale' : ''} ${dragOverTaskId === task.id ? 'border-t-2 border-t-[#1f6feb]' : ''}`}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-gray-300" />
                {task.fromProject && !isGhost(task.id) && (
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#1f6feb]" title="Adicionada no projeto" />
                )}
                {editingTaskId === task.id ? (
                  <input
                    autoFocus
                    value={editingTaskVal}
                    onChange={e => setEditingTaskVal(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitTaskRename(task.id);
                      if (e.key === 'Escape') setEditingTaskId(null);
                    }}
                    onBlur={() => commitTaskRename(task.id)}
                    className="flex-1 min-w-0 text-[12px] text-gray-700 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-blue-300"
                  />
                ) : (
                  <span
                    className={`flex-1 text-[12px] truncate ${isGhost(task.id) ? 'text-gray-400 line-through' : 'text-gray-700 cursor-text hover:text-[#1f6feb]'}`}
                    title={isGhost(task.id) ? undefined : 'Clique para renomear'}
                    onClick={e => {
                      if (isGhost(task.id)) return;
                      e.stopPropagation();
                      setEditingTaskId(task.id);
                      setEditingTaskVal(task.title);
                    }}
                  >
                    {task.title}
                  </span>
                )}
                {isGhost(task.id) && (
                  <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 bg-gray-100 rounded px-1 py-0.5 shrink-0" title="Excluída no projeto — apague aqui também para remover de vez">
                    removida no projeto
                  </span>
                )}
                {(task.subtasks?.length ?? 0) > 0 && (
                  <span className="text-[10px] text-gray-300 shrink-0">{task.subtasks!.length}</span>
                )}
                <button
                  onClick={e => { e.stopPropagation(); setAddingSubtaskFor(addingSubtaskFor === task.id ? null : task.id); setNewSubtaskTitle(''); }}
                  className="opacity-0 group-hover/task:opacity-100 text-gray-300 hover:text-[#1f6feb] transition-all"
                  title="Adicionar subtarefa"
                >
                  <Plus size={11} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); deleteFlowNodeTask(flowId, node.id, task.id); }}
                  className="opacity-0 group-hover/task:opacity-100 text-gray-300 hover:text-red-400 transition-all"
                  title="Apagar tarefa e suas subtarefas"
                >
                  <X size={11} />
                </button>
              </div>

              {/* Subtasks — indented under their task */}
              {(task.subtasks ?? []).map(sub => (
                <div
                  key={sub.id}
                  className="flex items-center gap-2 pl-7 pr-3 py-2 border-b border-gray-50 group/sub hover:bg-gray-50 transition-colors"
                >
                  <span className="text-gray-300 text-[11px] leading-none shrink-0">↳</span>
                  {editingTaskId === sub.id ? (
                    <input
                      autoFocus
                      value={editingTaskVal}
                      onChange={e => setEditingTaskVal(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitTaskRename(sub.id);
                        if (e.key === 'Escape') setEditingTaskId(null);
                      }}
                      onBlur={() => commitTaskRename(sub.id)}
                      className="flex-1 min-w-0 text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-blue-300"
                    />
                  ) : (
                    <span
                      className={`flex-1 text-[11px] truncate ${isGhost(sub.id) ? 'text-gray-400 line-through opacity-70' : 'text-gray-500 cursor-text hover:text-[#1f6feb]'}`}
                      title={isGhost(sub.id) ? undefined : 'Clique para renomear'}
                      onClick={e => {
                        if (isGhost(sub.id)) return;
                        e.stopPropagation();
                        setEditingTaskId(sub.id);
                        setEditingTaskVal(sub.title);
                      }}
                    >
                      {sub.title}
                    </span>
                  )}
                  {isGhost(sub.id) && (
                    <span className="text-[8px] font-bold uppercase text-gray-400 bg-gray-100 rounded px-1 py-0.5 shrink-0">removida</span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); deleteFlowNodeSubtask(flowId, node.id, task.id, sub.id); }}
                    className="opacity-0 group-hover/sub:opacity-100 text-gray-300 hover:text-red-400 transition-all"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}

              {/* Inline subtask composer */}
              {addingSubtaskFor === task.id && (
                <div className="flex items-center gap-1.5 pl-7 pr-3 py-1.5 border-b border-gray-50" onClick={e => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={newSubtaskTitle}
                    onChange={e => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddSubtask(task.id);
                      if (e.key === 'Escape') { setAddingSubtaskFor(null); setNewSubtaskTitle(''); }
                    }}
                    placeholder="Nome da subtarefa..."
                    className="flex-1 text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:border-blue-300"
                  />
                  <button onClick={() => handleAddSubtask(task.id)} className="w-5 h-5 flex items-center justify-center rounded bg-green-500 text-white shrink-0">
                    <Check size={10} />
                  </button>
                  <button onClick={() => { setAddingSubtaskFor(null); setNewSubtaskTitle(''); }} className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 text-gray-400 shrink-0">
                    <X size={10} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Add task — dropping a row here sends it to the end of the list */}
          <div
            className={`px-3 py-2 ${dragOverEnd ? 'border-t-2 border-t-[#1f6feb]' : ''}`}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverEnd(true); }}
            onDragLeave={() => setDragOverEnd(false)}
            onDrop={e => { e.preventDefault(); e.stopPropagation(); handleRowDrop(null); }}
          >
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

      {/* Connection handles — one per side, so flows can run vertically too.
          The arrow itself routes by proximity; any handle starts the same
          connection, the grabbed side just shapes the preview. */}
      {(hovered || selected) && !connecting && ([
        { key: 'right',  style: { right: -14, top: nodeHeight / 2 - 14 } },
        { key: 'left',   style: { left: -14, top: nodeHeight / 2 - 14 } },
        { key: 'top',    style: { top: -14, left: node.width / 2 - 14 } },
        { key: 'bottom', style: { bottom: -14, left: node.width / 2 - 14 } },
      ] as const).map(h => (
        <div
          key={h.key}
          className="absolute w-7 h-7 rounded-full bg-white border-2 border-[#1f6feb] hover:bg-[#1f6feb] cursor-crosshair transition-colors flex items-center justify-center shadow-md group/handle"
          style={h.style as React.CSSProperties}
          onMouseDown={e => { e.stopPropagation(); onConnectFrom(e); }}
          title="Arrastar para conectar"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="text-[#1f6feb] group-hover/handle:text-white transition-colors">
            <path d="M1 6H10M7 3L10 6L7 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      ))}

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
  // Follow the mouse from whichever side is nearest to it, so pulling upwards
  // previews a top exit instead of always snaking out of the right edge.
  const a = nodeAnchors(from).reduce((best, an) =>
    Math.hypot(toPos.x - an.x, toPos.y - an.y) < Math.hypot(toPos.x - best.x, toPos.y - best.y) ? an : best);
  const bend = Math.max(40, Math.hypot(toPos.x - a.x, toPos.y - a.y) * 0.45);
  return (
    <path
      d={`M ${a.x} ${a.y} C ${a.x + a.dx * bend} ${a.y + a.dy * bend} ${toPos.x} ${toPos.y} ${toPos.x} ${toPos.y}`}
      fill="none" stroke="#1f6feb" strokeWidth={2} strokeDasharray="6,4"
      markerEnd="url(#arrowhead-preview)"
      style={{ pointerEvents: 'none' }}
    />
  );
}

// ─── Save as Project modal ────────────────────────────────────────────────────

// ─── Phase band header ────────────────────────────────────────────────────────
// Rendered OUTSIDE the pan/zoom transform, pinned to the top of the viewport
// within the band's horizontal range — so the phase name stays readable no
// matter how far the user pans vertically. Dragging it moves the band; the
// right-edge handle resizes it.
function LaneHeader({
  lane, left, width, selected, blockCount,
  onSelect, onRename, onRecolor, onDeleteRequest, onDragStart, onResizeStart,
}: {
  lane: FlowLane;
  left: number;
  width: number;
  selected: boolean;
  blockCount: number;
  onSelect: () => void;
  onRename: (title: string) => void;
  onRecolor: (color: string) => void;
  onDeleteRequest: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [titleVal, setTitleVal] = useState(lane.title);

  const commit = () => {
    if (titleVal.trim()) onRename(titleVal.trim());
    else setTitleVal(lane.title);
    setEditing(false);
  };

  return (
    <div
      className="absolute top-2 z-20 select-none"
      style={{ left, width: Math.max(width, 90) }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div
        className="mx-1 rounded-lg border bg-white/95 backdrop-blur-sm shadow-sm px-2.5 py-1.5 flex items-center gap-2 cursor-grab active:cursor-grabbing"
        style={{ borderColor: `${lane.color}55`, boxShadow: selected ? `0 0 0 2px ${lane.color}66` : undefined }}
        onMouseDown={e => { onSelect(); onDragStart(e); }}
      >
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: lane.color }} />
        {editing ? (
          <input
            autoFocus
            value={titleVal}
            onChange={e => setTitleVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') { setTitleVal(lane.title); setEditing(false); }
            }}
            onBlur={commit}
            onMouseDown={e => e.stopPropagation()}
            className="flex-1 min-w-0 text-[12px] font-bold text-gray-800 bg-transparent outline-none border-b"
            style={{ borderColor: lane.color }}
          />
        ) : (
          <span
            className="flex-1 min-w-0 text-[12px] font-bold text-gray-800 truncate"
            onDoubleClick={() => { setTitleVal(lane.title); setEditing(true); }}
            title="Duplo clique para renomear"
          >
            {lane.title}
          </span>
        )}
        <span className="text-[10px] text-gray-400 shrink-0">
          {blockCount} {blockCount === 1 ? 'bloco' : 'blocos'}
        </span>
      </div>

      {/* Selected: colour palette + rename + delete */}
      {selected && !editing && (
        <div
          className="mt-1.5 mx-1 rounded-lg border border-gray-100 bg-white shadow-md px-2.5 py-2 flex items-center gap-1.5"
          onMouseDown={e => e.stopPropagation()}
        >
          {LANE_PALETTE.map(c => (
            <button
              key={c}
              onClick={() => onRecolor(c)}
              className={`w-[18px] h-[18px] rounded-full border-2 transition-transform hover:scale-110 ${lane.color === c ? 'border-gray-500' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <div className="w-px h-4 bg-gray-100 mx-1" />
          <button
            onClick={() => { setTitleVal(lane.title); setEditing(true); }}
            className="text-[11px] text-gray-400 hover:text-gray-700 font-medium transition-colors"
          >
            Renomear
          </button>
          <button
            onClick={onDeleteRequest}
            className="ml-1 text-gray-300 hover:text-red-400 transition-colors"
            title="Apagar fase"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {/* Width resize handle — sits at the band's right edge */}
      <div
        className="absolute -right-1 top-0 h-7 w-2.5 cursor-ew-resize flex items-center justify-center group/handle"
        onMouseDown={e => { onSelect(); onResizeStart(e); }}
        title="Arrastar para ajustar a largura"
      >
        <div className="w-1 h-4 rounded-full bg-gray-300 group-hover/handle:bg-gray-500 transition-colors" />
      </div>
    </div>
  );
}

function SaveAsProjectModal({ board, onClose }: { board: FlowBoard; onClose: () => void }) {
  const { companies, teams, addProject, addTask, setActiveProject, updateFlow } = useAppStore();
  const [projectName, setProjectName] = useState(board.name);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  const canSave = projectName.trim() && selectedCompanyId;

  const handleSave = () => {
    if (!canSave) return;
    const now = localISO();
    const ts = Date.now();
    const projectId = `proj-${ts}`;

    // Names must be unique: every view groups tasks by phase NAME, and a
    // duplicate would show the same tasks under both groups.
    const dedupe = () => {
      const seen = new Map<string, number>();
      return (title: string) => {
        const nth = (seen.get(title) ?? 0) + 1;
        seen.set(title, nth);
        return nth === 1 ? title : `${title} (${nth})`;
      };
    };

    // When the board has phase bands, THEY are the project's phases — left to
    // right, exactly as drawn. Each block contributes its tasks to the band it
    // sits in (nearest band when it's outside all of them). Without bands, the
    // old behaviour stands: each block becomes a phase of its own.
    const lanes = [...(board.lanes ?? [])].sort((a, b) => a.x - b.x);
    const usingLanes = lanes.length > 0;

    const uniq = dedupe();
    const laneNames = lanes.map(l => uniq(l.title));
    const nodePhaseName = board.nodes.map(n => {
      if (!usingLanes) return ''; // filled by the per-node dedupe below
      const cx = n.x + n.width / 2;
      let idx = lanes.findIndex(l => cx >= l.x && cx <= l.x + l.width);
      if (idx === -1) {
        let best = 0, bestD = Infinity;
        lanes.forEach((l, i) => {
          const d = Math.abs(cx - (l.x + l.width / 2));
          if (d < bestD) { bestD = d; best = i; }
        });
        idx = best;
      }
      return laneNames[idx];
    });
    if (!usingLanes) {
      const uniqNode = dedupe();
      board.nodes.forEach((n, i) => { nodePhaseName[i] = uniqNode(n.title); });
    }

    const phases: ProjectPhase[] = usingLanes
      ? lanes.map((_, i) => ({ id: `ph-${ts}-${i}`, name: laneNames[i] }))
      : board.nodes.length
        ? board.nodes.map((_, i) => ({ id: `ph-${ts}-${i}`, name: nodePhaseName[i] }))
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
      endDate: localISO(new Date(ts + 90 * 86400000)),
      teamMemberIds,
      color: board.nodes[0]?.color ?? '#1f6feb',
      phases,
    };

    const taskDue = localISO(new Date(ts + 30 * 86400000));
    const tasks: Task[] = board.nodes.flatMap((n, ni) => {
      const base = {
        projectId,
        phase: nodePhaseName[ni],
        status: 'Backlog' as const,
        priority: 'Medium' as const,
        dueDate: taskDue,
        createdAt: now,
      };
      if (usingLanes && n.tasks.length === 0) {
        // Block titles stop being phases when bands exist; keep the block's
        // content by importing it as a task inside its band.
        return [{ ...base, id: `t-${ts}-${ni}-solo`, title: n.title, type: 'Copy' as const }];
      }
      return n.tasks.flatMap((ft, ti) => {
        const parentId = `t-${ts}-${ni}-${ti}`;
        return [
          // flowTaskId twins each project task with its flow counterpart, so the
          // two views can mirror additions and grey out one-sided deletions.
          { ...base, id: parentId, title: ft.title, type: ft.type ?? 'Copy', flowTaskId: ft.id, origin: 'flow' as const },
          ...(ft.subtasks ?? []).map((st, si) => ({
            ...base,
            id: `${parentId}-s${si}`,
            title: st.title,
            type: ft.type ?? 'Copy',
            parentTaskId: parentId,
            flowTaskId: st.id,
            origin: 'flow' as const,
          })),
        ];
      });
    });

    addProject(project);
    tasks.forEach(t => addTask(t));
    // Wire the board to the project it just generated: from here on, lanes
    // drive the phases and task changes mirror across the two views.
    updateFlow(board.id, { linkedProjectId: projectId });
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
            {(board.lanes ?? []).length > 0
              ? 'As fases do fundo virarão as fases do projeto, e cada bloco leva suas tarefas para a fase em que está.'
              : 'As etapas do fluxo virarão fases e as tarefas serão importadas automaticamente.'}
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

export function FlowCanvas({ boardId, embedded = false }: { boardId: string; embedded?: boolean }) {
  const { flows, templates, addFlowNode, addFlowEdge, deleteFlowEdge, deleteFlowNode, addTemplate, addFlowLane, updateFlowLane, deleteFlowLane } = useAppStore();
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
  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [pendingDeleteLaneId, setPendingDeleteLaneId] = useState<string | null>(null);
  // Dragging a phase band: 'move' shifts x, 'resize' adjusts width. Values are
  // captured at mousedown; deltas are divided by zoom to stay in canvas units.
  const [laneDrag, setLaneDrag] = useState<{ laneId: string; mode: 'move' | 'resize'; startClientX: number; laneX: number; laneWidth: number } | null>(null);

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
    setSelectedLaneId(null);
    setConnectingFrom(null);
  };

  const handleWrapperMouseMove = (e: React.MouseEvent) => {
    const pos = toCanvas(e.clientX, e.clientY);
    setMouseCanvas(pos);

    if (laneDrag) {
      const dx = (e.clientX - laneDrag.startClientX) / zoom;
      if (laneDrag.mode === 'move') {
        updateFlowLane(boardId, laneDrag.laneId, { x: laneDrag.laneX + dx });
      } else {
        updateFlowLane(boardId, laneDrag.laneId, { width: Math.max(LANE_MIN_WIDTH, laneDrag.laneWidth + dx) });
      }
      return;
    }

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
    setLaneDrag(null);
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

  const handleAddLane = () => {
    const lanes = board?.lanes ?? [];
    const rect = wrapperRef.current?.getBoundingClientRect();
    // New band goes right after the last one, so building a timeline
    // left-to-right needs no repositioning; the first one lands at the viewport.
    const last = lanes.reduce<FlowLane | null>((a, l) => (!a || l.x + l.width > a.x + a.width ? l : a), null);
    const x = last
      ? last.x + last.width + 16
      : rect ? (rect.width / 2 - pan.x) / zoom - 170 : 60;
    const lane: FlowLane = {
      id: `fl${Date.now()}`,
      title: 'Nova fase',
      color: LANE_PALETTE[lanes.length % LANE_PALETTE.length],
      x,
      width: 340,
    };
    addFlowLane(boardId, lane);
    setSelectedLaneId(lane.id);
  };

    const handleAddFromTemplate = (tpl: { id: string; name: string; tasks: Array<{ title: string; type?: string; subtasks?: Array<{ title: string }> }> }) => {
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
        subtasks: (t.subtasks ?? []).map((st, si) => ({ id: `fns${Date.now()}-${i}-${si}`, title: st.title })),
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
        subtasks: (t.subtasks ?? []).map(st => ({
          title: st.title,
          type: t.type ?? 'Copy',
          phase: node.title,
          priority: 'Medium' as const,
        })),
      })),
      createdAt: localISO(),
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
    const maxY = Math.max(...board.nodes.map(n => n.y + nodeEstHeight(n)));
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const newZoom = Math.min(0.95, Math.min((rect.width - 120) / contentW, (rect.height - 120) / contentH));
    const newPanX = (rect.width - contentW * newZoom) / 2 - minX * newZoom;
    const newPanY = (rect.height - contentH * newZoom) / 2 - minY * newZoom;
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  if (!board) return null;

  // An edge is lifted above the cards while the user interacts with it:
  // hovering it, or selecting either block it connects.
  const isEdgeElevated = (e: FlowEdge) =>
    e.id === hoveredEdgeId ||
    (!!selectedId && (e.fromId === selectedId || e.toId === selectedId));

  // Canvas size for SVG (large enough)
  const svgW = 8000;
  const svgH = 6000;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[#E5E7EB] shrink-0">
        {!embedded && (
          <>
            <button
              onClick={() => useAppStore.setState({ activeFlowId: null })}
              className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft size={14} />
              Fluxos
            </button>
            <span className="text-gray-200">/</span>
            <span className="text-[13px] font-semibold text-[#111]">{board.name}</span>
          </>
        )}

        <div className="flex-1" />

        {connectingFrom && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[12px] text-blue-700 font-medium">Clique em outro bloco para conectar · Esc para cancelar</span>
          </div>
        )}

        {/* Linked project chip / save button */}
        {(() => {
          if (embedded) return null;
          const linked = board.linkedProjectId ? useAppStore.getState().projects.find(p => p.id === board.linkedProjectId) : undefined;
          if (!linked) return null;
          return (
            <button
              onClick={() => {
                useAppStore.getState().setActiveCompany(linked.companyId);
                useAppStore.getState().setActiveProject(linked.id);
                useAppStore.getState().setView('project');
              }}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-semibold border border-[#1f6feb]/30 bg-[#1f6feb]/5 text-[#1f6feb] hover:bg-[#1f6feb]/10 transition-colors"
              title="Este fluxo está interligado ao projeto — fases e tarefas se espelham"
            >
              <FolderKanban size={13} />
              Projeto: {linked.name}
            </button>
          );
        })()}
        {!(board.linkedProjectId && useAppStore.getState().projects.some(p => p.id === board.linkedProjectId)) && (
        <button
          onClick={() => setShowSaveAsProject(true)}
          className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#1f6feb' }}
        >
          <FolderKanban size={13} />
          Salvar como projeto
        </button>
        )}

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
          {/* Phase bands */}
          <div className="px-3 pt-4 pb-3">
            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-2 px-1">Fases</p>
            <button
              onClick={handleAddLane}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left group"
            >
              <span className="text-[14px] leading-none shrink-0">🏁</span>
              <span className="text-[11px] text-gray-500 group-hover:text-gray-700 font-medium leading-none">Nova fase</span>
            </button>
            <p className="text-[10px] text-gray-300 px-1 mt-1.5 leading-relaxed">
              Colunas de fundo com nome, cor e largura. Ao salvar como projeto, viram as fases dele.
            </p>
          </div>

          <div className="mx-3 border-t border-gray-100" />

          {/* Block types */}
          <div className="px-3 pt-3 pb-3">
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
            {/* Phase bands — pure background, behind everything and inert to the
                mouse so panning, selecting and dragging blocks work through them. */}
            {(board.lanes ?? []).map(lane => (
              <div
                key={lane.id}
                className="absolute pointer-events-none"
                style={{
                  left: lane.x,
                  top: -2000,
                  width: lane.width,
                  height: svgH + 4000,
                  backgroundColor: `${lane.color}0d`,
                  borderLeft: `2px solid ${lane.color}${selectedLaneId === lane.id ? '88' : '33'}`,
                  borderRight: `2px solid ${lane.color}${selectedLaneId === lane.id ? '88' : '33'}`,
                }}
              />
            ))}

            {/* Edges — wiring lives BELOW the cards so long connections don't
                slice through card bodies. But an edge the user is interacting
                with is LIFTED above them (see the overlay further down): hover
                any exposed stretch, or select either endpoint block, and the
                arrow pops to the front with its delete button — so even a fully
                covered connection stays visible and removable. */}
            <svg
              className="absolute inset-0 overflow-visible"
              width={svgW}
              height={svgH}
              style={{ pointerEvents: 'none' }}
            >
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
                </marker>
                <marker id="arrowhead-hover" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#1f6feb" />
                </marker>
              </defs>
              <g style={{ pointerEvents: 'all' }}>
                {board.edges.filter(e => !isEdgeElevated(e)).map(edge => (
                  <EdgeLine
                    key={edge.id}
                    edge={edge}
                    nodes={board.nodes}
                    onDelete={() => deleteFlowEdge(boardId, edge.id)}
                    hovered={false}
                    emphasized={false}
                    onHoverStart={() => setHoveredEdgeId(edge.id)}
                    onHoverEnd={() => setHoveredEdgeId(id => (id === edge.id ? null : id))}
                  />
                ))}
              </g>
            </svg>

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

            {/* Elevated edges + connection preview — the lines being interacted
                with, drawn ABOVE the cards. */}
            <svg
              className="absolute inset-0 overflow-visible"
              width={svgW}
              height={svgH}
              style={{ pointerEvents: 'none', zIndex: 10 }}
            >
              <defs>
                <marker id="arrowhead-preview" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#1f6feb" />
                </marker>
              </defs>
              <g style={{ pointerEvents: 'all' }}>
                {board.edges.filter(isEdgeElevated).map(edge => (
                  <EdgeLine
                    key={edge.id}
                    edge={edge}
                    nodes={board.nodes}
                    onDelete={() => deleteFlowEdge(boardId, edge.id)}
                    hovered={hoveredEdgeId === edge.id}
                    emphasized={!!selectedId && (edge.fromId === selectedId || edge.toId === selectedId)}
                    onHoverStart={() => setHoveredEdgeId(edge.id)}
                    onHoverEnd={() => setHoveredEdgeId(id => (id === edge.id ? null : id))}
                  />
                ))}
              </g>
              {connectingFrom && (
                <PreviewEdge fromId={connectingFrom} toPos={mouseCanvas} nodes={board.nodes} />
              )}
            </svg>
          </div>

          {/* Phase headers — pinned to the top of the viewport within each band's
              horizontal range, so names stay readable at any vertical pan. */}
          {(board.lanes ?? []).map(lane => (
            <LaneHeader
              key={lane.id}
              lane={lane}
              left={pan.x + lane.x * zoom}
              width={lane.width * zoom}
              selected={selectedLaneId === lane.id}
              blockCount={board.nodes.filter(n => {
                const cx = n.x + n.width / 2;
                return cx >= lane.x && cx <= lane.x + lane.width;
              }).length}
              onSelect={() => { setSelectedLaneId(lane.id); setSelectedId(null); }}
              onRename={title => updateFlowLane(boardId, lane.id, { title })}
              onRecolor={color => updateFlowLane(boardId, lane.id, { color })}
              onDeleteRequest={() => setPendingDeleteLaneId(lane.id)}
              onDragStart={e => setLaneDrag({ laneId: lane.id, mode: 'move', startClientX: e.clientX, laneX: lane.x, laneWidth: lane.width })}
              onResizeStart={e => setLaneDrag({ laneId: lane.id, mode: 'resize', startClientX: e.clientX, laneX: lane.x, laneWidth: lane.width })}
            />
          ))}

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

      {pendingDeleteLaneId && (() => {
        const lane = (board.lanes ?? []).find(l => l.id === pendingDeleteLaneId);
        if (!lane) return null;
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setPendingDeleteLaneId(null)}>
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ width: 360 }} onClick={e => e.stopPropagation()}>
              <div className="px-6 pt-6 pb-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                    <Trash2 size={16} className="text-red-500" />
                  </div>
                  <h2 className="text-[15px] font-bold text-gray-900">Apagar a fase "{lane.title}"?</h2>
                </div>
                <p className="text-[13px] text-gray-500 leading-relaxed">
                  Só o fundo colorido é removido — os blocos dentro dele continuam no fluxo.
                </p>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
                <button
                  onClick={() => { deleteFlowLane(boardId, lane.id); setSelectedLaneId(null); setPendingDeleteLaneId(null); }}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
                >
                  Sim, apagar
                </button>
                <button onClick={() => setPendingDeleteLaneId(null)} className="px-4 py-2.5 rounded-xl text-[13px] text-gray-500 hover:bg-gray-100 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
