import { useRef, useState } from 'react';
import { X, Plus, Trash2, GripVertical, Layers, ChevronDown, ChevronRight, Check } from 'lucide-react';
import type { ProjectPhase, PhaseTemplate } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { localISO } from '../../lib/date';

interface Props {
  projectId: string;
  phases: ProjectPhase[];
  onClose: () => void;
}

export function PhaseEditor({ projectId, phases: initialPhases, onClose }: Props) {
  const { addPhase, renamePhase, deletePhase, reorderPhases, phaseTemplates, addPhaseTemplate, deletePhaseTemplate, applyPhaseTemplate } = useAppStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newPhaseName, setNewPhaseName] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [confirmDeletePhaseId, setConfirmDeletePhaseId] = useState<string | null>(null);
  const [confirmDeleteTemplateId, setConfirmDeleteTemplateId] = useState<string | null>(null);
  const dragRef = useRef<string | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);

  // Use live phases from store
  const { projects } = useAppStore();
  const project = projects.find(p => p.id === projectId);
  const phases = project?.phases ?? initialPhases;

  const startEdit = (ph: ProjectPhase) => {
    setEditingId(ph.id);
    setEditingName(ph.name);
  };

  const commitEdit = (phaseId: string) => {
    const name = editingName.trim();
    if (name) renamePhase(projectId, phaseId, name);
    setEditingId(null);
  };

  const handleAddPhase = () => {
    const name = newPhaseName.trim();
    if (name) {
      addPhase(projectId, name);
      setNewPhaseName('');
      setAddingNew(false);
    }
  };

  const handleSaveTemplate = () => {
    const name = templateName.trim();
    if (!name) return;
    const template: PhaseTemplate = {
      id: `ptpl-${Date.now()}`,
      name,
      phases: phases.map(p => p.name),
      createdAt: localISO(),
    };
    addPhaseTemplate(template);
    setTemplateName('');
    setShowSaveTemplate(false);
  };

  // Drag-to-reorder
  const handleDragStart = (e: React.DragEvent, id: string) => {
    dragRef.current = id;
    // Firefox won't start a drag unless the event carries data.
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOver(id);
  };
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const srcId = dragRef.current;
    if (!srcId || srcId === targetId) { setDragOver(null); return; }
    const arr = [...phases];
    const from = arr.findIndex(p => p.id === srcId);
    if (from < 0) { setDragOver(null); return; }
    const [item] = arr.splice(from, 1);
    // Recompute the target AFTER the removal: taking the index beforehand made
    // dragging a phase downwards land it one slot past where it was dropped,
    // while dragging upwards behaved correctly.
    const to = arr.findIndex(p => p.id === targetId);
    if (to < 0) { setDragOver(null); return; }
    arr.splice(to, 0, item);
    reorderPhases(projectId, arr);
    setDragOver(null);
    dragRef.current = null;
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col" style={{ maxHeight: '85vh' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
            <div>
              <p className="text-[14px] font-bold text-gray-900">Editar fases</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{phases.length} fases neste projeto</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
              <X size={15} />
            </button>
          </div>

          {/* Phase list */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <div className="space-y-1">
              {phases.map(ph => (
                <div
                  key={ph.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, ph.id)}
                  onDragOver={(e) => handleDragOver(e, ph.id)}
                  onDrop={(e) => handleDrop(e, ph.id)}
                  onDragLeave={() => setDragOver(null)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors group ${
                    dragOver === ph.id ? 'border-[#1f6feb]/40 bg-orange-50/40' : 'border-gray-100 hover:border-gray-200 bg-white'
                  }`}
                >
                  {/* Drag handle */}
                  <GripVertical size={14} className="text-gray-300 cursor-grab shrink-0" />

                  {/* Name (editable on click) */}
                  {editingId === ph.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitEdit(ph.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onBlur={() => commitEdit(ph.id)}
                      className="flex-1 text-[13px] font-medium text-gray-800 bg-transparent outline-none border-b border-[#1f6feb]/50"
                    />
                  ) : (
                    <span
                      onClick={() => startEdit(ph)}
                      className="flex-1 text-[13px] font-medium text-gray-700 cursor-text hover:text-gray-900 truncate"
                    >
                      {ph.name}
                    </span>
                  )}

                  {/* Delete / inline confirmation */}
                  {confirmDeletePhaseId === ph.id ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] text-red-500 font-medium">Apagar?</span>
                      <button
                        onClick={() => { deletePhase(projectId, ph.id); setConfirmDeletePhaseId(null); }}
                        className="w-5 h-5 flex items-center justify-center rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                      >
                        <Check size={9} strokeWidth={3} />
                      </button>
                      <button
                        onClick={() => setConfirmDeletePhaseId(null)}
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 transition-colors"
                      >
                        <X size={9} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeletePhaseId(ph.id)}
                      disabled={phases.length <= 1}
                      className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all disabled:opacity-0 shrink-0"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add new phase */}
            {addingNew ? (
              <div className="flex items-center gap-2 mt-2 px-3 py-2.5 rounded-xl border border-[#1f6feb]/30 bg-orange-50/30">
                <Plus size={13} className="text-[#1f6feb] shrink-0" />
                <input
                  ref={newInputRef}
                  autoFocus
                  type="text"
                  value={newPhaseName}
                  onChange={e => setNewPhaseName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddPhase();
                    if (e.key === 'Escape') { setAddingNew(false); setNewPhaseName(''); }
                  }}
                  onBlur={() => { if (!newPhaseName.trim()) setAddingNew(false); else handleAddPhase(); }}
                  placeholder="Nome da fase... (Enter para adicionar)"
                  className="flex-1 text-[13px] text-gray-700 bg-transparent outline-none placeholder-gray-400"
                />
              </div>
            ) : (
              <button
                onClick={() => { setAddingNew(true); setTimeout(() => newInputRef.current?.focus(), 50); }}
                className="w-full mt-2 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-gray-200 text-[13px] text-gray-400 hover:border-[#1f6feb]/40 hover:text-[#1f6feb] transition-colors"
              >
                <Plus size={13} />
                Adicionar fase
              </button>
            )}
          </div>

          {/* Templates section */}
          <div className="border-t border-gray-100 px-4 py-3 shrink-0">

            {/* Templates toggle */}
            <button
              onClick={() => setShowTemplates(v => !v)}
              className="w-full flex items-center gap-2 py-1.5 text-[12px] font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Layers size={13} className="text-gray-400" />
              <span>Templates de fases</span>
              <span className="ml-auto text-gray-400">
                {showTemplates ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
            </button>

            {showTemplates && (
              <div className="mt-2 space-y-1.5">
                {phaseTemplates.length === 0 && (
                  <p className="text-[12px] text-gray-400 py-2 text-center">Nenhum template salvo ainda.</p>
                )}
                {phaseTemplates.map(tpl => (
                  <div key={tpl.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-gray-700 truncate">{tpl.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{tpl.phases.join(' → ')}</p>
                    </div>
                    <button
                      onClick={() => { applyPhaseTemplate(tpl.id, projectId); onClose(); }}
                      className="text-[11px] font-semibold text-[#1f6feb] hover:underline shrink-0"
                    >
                      Aplicar
                    </button>
                    {confirmDeleteTemplateId === tpl.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-red-500 font-medium">Apagar?</span>
                        <button
                          onClick={() => { deletePhaseTemplate(tpl.id); setConfirmDeleteTemplateId(null); }}
                          className="w-5 h-5 flex items-center justify-center rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                          <Check size={9} strokeWidth={3} />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteTemplateId(null)}
                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 transition-colors"
                        >
                          <X size={9} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteTemplateId(tpl.id)}
                        className="w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-red-400 transition-colors shrink-0"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                ))}

                {/* Save current phases as template */}
                {showSaveTemplate ? (
                  <div className="flex items-center gap-2 mt-1 px-3 py-2 rounded-xl border border-[#1f6feb]/30 bg-orange-50/30">
                    <input
                      ref={templateInputRef}
                      autoFocus
                      type="text"
                      value={templateName}
                      onChange={e => setTemplateName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveTemplate();
                        if (e.key === 'Escape') setShowSaveTemplate(false);
                      }}
                      placeholder="Nome do template..."
                      className="flex-1 text-[12px] text-gray-700 bg-transparent outline-none placeholder-gray-400"
                    />
                    <button onClick={handleSaveTemplate} className="text-green-500 hover:text-green-600">
                      <Check size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSaveTemplate(true)}
                    className="w-full flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-gray-200 text-[12px] text-gray-400 hover:border-[#1f6feb]/40 hover:text-[#1f6feb] transition-colors"
                  >
                    <Plus size={11} />
                    Salvar fases atuais como template
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 shrink-0">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-white transition-colors"
              style={{ backgroundColor: '#1f6feb' }}
            >
              Concluído
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
