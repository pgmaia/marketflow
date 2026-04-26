import { useState } from 'react';
import { X, Check, Layers, Trash2, ChevronDown, ChevronRight, Zap } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface Props {
  projectId: string;
  onClose: () => void;
}

export function ApplyTemplateModal({ projectId, onClose }: Props) {
  const { templates, deleteTemplate, applyTemplate } = useAppStore();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleApply = (templateId: string) => {
    applyTemplate(templateId, projectId);
    setApplied(templateId);
    setTimeout(() => { setApplied(null); onClose(); }, 800);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" style={{ maxHeight: '80vh' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FF5C35]/10 flex items-center justify-center">
                <Layers size={15} className="text-[#FF5C35]" />
              </div>
              <div>
                <p className="text-[14px] font-bold text-gray-900">Templates salvos</p>
                <p className="text-[11px] text-gray-400">{templates.length} {templates.length === 1 ? 'template disponível' : 'templates disponíveis'}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
              <X size={15} />
            </button>
          </div>

          {/* Template list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {templates.length === 0 && (
              <div className="text-center py-12">
                <Layers size={32} className="text-gray-200 mx-auto mb-3" />
                <p className="text-[14px] font-semibold text-gray-400">Nenhum template ainda</p>
                <p className="text-[12px] text-gray-300 mt-1">Selecione tarefas na view de lista e salve como template.</p>
              </div>
            )}

            {templates.map(tpl => {
              const isExpanded = expanded === tpl.id;
              const isApplied = applied === tpl.id;
              return (
                <div key={tpl.id} className="border border-gray-100 rounded-xl overflow-hidden hover:border-gray-200 transition-colors">
                  {/* Template header row */}
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : tpl.id)}
                      className="text-gray-300 hover:text-gray-500 transition-colors shrink-0"
                    >
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-gray-800 truncate">{tpl.name}</p>
                      {tpl.description && (
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{tpl.description}</p>
                      )}
                    </div>

                    <span className="text-[11px] text-gray-400 shrink-0">{tpl.tasks.length} tarefas</span>

                    <button
                      onClick={() => handleApply(tpl.id)}
                      disabled={!!applied}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all shrink-0 ${
                        isApplied
                          ? 'bg-green-100 text-green-600'
                          : 'text-white hover:opacity-90 disabled:opacity-50'
                      }`}
                      style={isApplied ? {} : { backgroundColor: '#FF5C35' }}
                    >
                      {isApplied ? '✓ Aplicado!' : <><Zap size={11} /> Aplicar</>}
                    </button>

                    {pendingDeleteId === tpl.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-red-500 font-medium whitespace-nowrap">Apagar?</span>
                        <button
                          onClick={() => { deleteTemplate(tpl.id); setPendingDeleteId(null); }}
                          className="w-6 h-6 flex items-center justify-center rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                          <Check size={10} strokeWidth={3} />
                        </button>
                        <button
                          onClick={() => setPendingDeleteId(null)}
                          className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setPendingDeleteId(tpl.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {/* Expanded task list */}
                  {isExpanded && (
                    <div className="border-t border-gray-50 bg-gray-50/50">
                      {tpl.tasks.map((t, i) => (
                        <div key={i} className="flex items-center gap-3 px-6 py-2.5 border-b border-gray-50 last:border-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                          <span className="flex-1 text-[12px] text-gray-600 truncate">{t.title}</span>
                          <span className="text-[10px] text-gray-400 shrink-0">{t.phase}</span>
                          <span className="text-[10px] text-gray-400 shrink-0">{t.priority}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
