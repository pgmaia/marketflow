import { useRef, useState } from 'react';
import { X, Layers, Tag } from 'lucide-react';
import type { Task, TaskTemplate } from '../../types';
import { useAppStore } from '../../store/useAppStore';

interface Props {
  tasks: Task[];
  onClose: () => void;
  onSaved: () => void;
}

export function SaveTemplateModal({ tasks, onClose, onSaved }: Props) {
  const { addTemplate, tasks: allTasks } = useAppStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // For each selected task, collect its subtasks from the global task list
  const subtasksOf = (taskId: string) => allTasks.filter(t => t.parentTaskId === taskId);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) { inputRef.current?.focus(); return; }

    const template: TaskTemplate = {
      id: `tpl-${Date.now()}`,
      name: trimmed,
      description: description.trim() || undefined,
      tasks: tasks.map(t => {
        const subs = subtasksOf(t.id);
        return {
          title: t.title,
          type: t.type,
          phase: t.phase,
          priority: t.priority,
          description: t.description,
          notes: t.notes,
          subtasks: subs.length > 0
            ? subs.map(s => ({
                title: s.title,
                type: s.type,
                phase: s.phase,
                priority: s.priority,
                description: s.description,
                notes: s.notes,
              }))
            : undefined,
        };
      }),
      createdAt: new Date().toISOString().split('T')[0],
    };

    addTemplate(template);
    onSaved();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#1f6feb]/10 flex items-center justify-center">
                <Layers size={15} className="text-[#1f6feb]" />
              </div>
              <div>
                <p className="text-[14px] font-bold text-gray-900">Salvar como template</p>
                <p className="text-[11px] text-gray-400">
                  {tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'}
                  {(() => { const subCount = tasks.reduce((n, t) => n + subtasksOf(t.id).length, 0); return subCount > 0 ? ` · ${subCount} subtarefa${subCount > 1 ? 's' : ''}` : ''; })()}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
              <X size={15} />
            </button>
          </div>

          {/* Task preview */}
          <div className="px-6 py-4 bg-gray-50/60 border-b border-gray-100 max-h-48 overflow-y-auto">
            {tasks.map(t => {
              const subs = subtasksOf(t.id);
              return (
                <div key={t.id}>
                  <div className="flex items-center gap-2 py-1.5">
                    <Tag size={11} className="text-gray-300 shrink-0" />
                    <span className="text-[12px] text-gray-600 truncate">{t.title}</span>
                    {subs.length > 0 && (
                      <span className="text-[10px] text-gray-400 shrink-0 bg-gray-200/70 px-1.5 py-0.5 rounded-full">
                        {subs.length} sub
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-gray-400 shrink-0">{t.phase}</span>
                  </div>
                  {subs.map(s => (
                    <div key={s.id} className="flex items-center gap-2 py-1 pl-6">
                      <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0" />
                      <span className="text-[11px] text-gray-400 truncate">{s.title}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Form */}
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
                Nome do template <span className="text-red-400">*</span>
              </label>
              <input
                ref={inputRef}
                autoFocus
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="Ex: Onboarding de cliente, Sprint de lançamento..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-gray-800 outline-none focus:border-[#1f6feb]/50 focus:ring-2 focus:ring-[#1f6feb]/10 placeholder-gray-300 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
                Descrição <span className="text-gray-300 font-normal">(opcional)</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Descreva quando usar este template..."
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-gray-700 outline-none resize-none focus:border-[#1f6feb]/50 focus:ring-2 focus:ring-[#1f6feb]/10 placeholder-gray-300 transition-colors"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-gray-100">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[13px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="px-5 py-2 rounded-lg text-[13px] font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#1f6feb' }}
            >
              Salvar template
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
