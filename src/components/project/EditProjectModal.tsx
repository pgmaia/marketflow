import { useState } from 'react';
import { FolderKanban, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { Project } from '../../types';

const PROJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#22c55e', '#14b8a6', '#3b82f6',
  '#1f6feb', '#64748b',
];

interface EditProjectModalProps {
  project: Project;
  onClose: () => void;
}

export function EditProjectModal({ project, onClose }: EditProjectModalProps) {
  const { updateProject } = useAppStore();

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [color, setColor] = useState(project.color);
  const [startDate, setStartDate] = useState(project.startDate);
  const [endDate, setEndDate] = useState(project.endDate);

  const canSubmit = name.trim().length > 0;

  const handleSave = () => {
    if (!canSubmit) return;
    updateProject(project.id, {
      name: name.trim(),
      description: description.trim(),
      color,
      startDate,
      endDate,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 460 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-5 flex items-start justify-between border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: color + '20' }}
            >
              <FolderKanban size={15} style={{ color }} />
            </div>
            <h2 className="text-[15px] font-bold text-[#111]">Editar projeto</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Nome *
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && canSubmit) handleSave();
                if (e.key === 'Escape') onClose();
              }}
              placeholder="Nome do projeto"
              className="mt-1.5 w-full text-[14px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#1f6feb] transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Descrição{' '}
              <span className="font-normal normal-case">(opcional)</span>
            </label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descreva o objetivo do projeto..."
              className="mt-1.5 w-full text-[14px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#1f6feb] transition-colors"
            />
          </div>

          {/* Color + dates */}
          <div className="grid grid-cols-2 gap-4">
            {/* Color */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Cor
              </label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {PROJECT_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: color === c ? '#111' : 'transparent',
                      boxShadow:
                        color === c
                          ? `0 0 0 2px white, 0 0 0 4px ${c}`
                          : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Dates */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Período
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="flex-1 text-[12px] bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:border-[#1f6feb] transition-colors"
                />
                <span className="text-gray-300 text-[11px] shrink-0">→</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="flex-1 text-[12px] bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:border-[#1f6feb] transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={handleSave}
            disabled={!canSubmit}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: '#1f6feb' }}
          >
            Salvar alterações
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-[13px] text-gray-500 hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
