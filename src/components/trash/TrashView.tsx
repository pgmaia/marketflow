import { useEffect } from 'react';
import {
  Trash2, RotateCcw, Building2, FolderKanban, CheckSquare,
  GitBranch, Layers, FileText, LayoutGrid, AlignLeft, Columns, X, AlertTriangle,
  MessagesSquare,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { TrashItem } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysInfo(deletedAt: string) {
  const elapsed = Math.floor((Date.now() - new Date(deletedAt).getTime()) / (1000 * 60 * 60 * 24));
  const remaining = 30 - elapsed;
  return { elapsed, remaining };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' });
}

// ─── Item metadata ────────────────────────────────────────────────────────────

const TYPE_META: Record<TrashItem['type'], { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  company:       { label: 'Empresa',              icon: <Building2 size={14} />,    color: 'text-violet-600',  bg: 'bg-violet-50' },
  project:       { label: 'Projeto',              icon: <FolderKanban size={14} />, color: 'text-blue-600',    bg: 'bg-blue-50' },
  task:          { label: 'Tarefa',               icon: <CheckSquare size={14} />,  color: 'text-green-600',   bg: 'bg-green-50' },
  flow:          { label: 'Fluxo',                icon: <GitBranch size={14} />,    color: 'text-orange-600',  bg: 'bg-orange-50' },
  flowNode:      { label: 'Bloco de fluxo',       icon: <Layers size={14} />,       color: 'text-amber-600',   bg: 'bg-amber-50' },
  taskTemplate:  { label: 'Template de tarefas',  icon: <FileText size={14} />,     color: 'text-pink-600',    bg: 'bg-pink-50' },
  phaseTemplate: { label: 'Template de fases',    icon: <LayoutGrid size={14} />,   color: 'text-teal-600',    bg: 'bg-teal-50' },
  phase:         { label: 'Fase',                 icon: <AlignLeft size={14} />,    color: 'text-slate-600',   bg: 'bg-slate-50' },
  customColumn:  { label: 'Coluna personalizada', icon: <Columns size={14} />,      color: 'text-gray-600',    bg: 'bg-gray-100' },
  docEntry:      { label: 'Registro',             icon: <MessagesSquare size={14} />, color: 'text-indigo-600', bg: 'bg-indigo-50' },
};

function itemName(item: TrashItem): string {
  switch (item.type) {
    case 'company':       return item.data.name;
    case 'project':       return item.data.name;
    case 'task':          return item.data.title;
    case 'flow':          return item.data.name;
    case 'flowNode':      return item.data.title;
    case 'taskTemplate':  return item.data.name;
    case 'phaseTemplate': return item.data.name;
    case 'phase':         return item.data.name;
    case 'customColumn':  return item.data.name;
    // The post itself is the name — trimmed, since it can be a long paragraph.
    case 'docEntry': {
      const firstLine = item.data.text.split('\n')[0].trim();
      return firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : (firstLine || 'Registro vazio');
    }
  }
}

function itemSubline(item: TrashItem): string | null {
  switch (item.type) {
    case 'company': {
      const p = item.projects.length;
      const t = item.tasks.length;
      return `${p} ${p === 1 ? 'projeto' : 'projetos'} · ${t} ${t === 1 ? 'tarefa' : 'tarefas'}`;
    }
    case 'project': {
      const t = item.tasks.length;
      return `${t} ${t === 1 ? 'tarefa' : 'tarefas'}`;
    }
    case 'task': {
      const s = item.subtasks.length;
      return s > 0 ? `${s} ${s === 1 ? 'subtarefa' : 'subtarefas'}` : null;
    }
    case 'flow': {
      const n = item.data.nodes.length;
      return `${n} ${n === 1 ? 'etapa' : 'etapas'}`;
    }
    case 'flowNode': {
      const t = item.data.tasks.length;
      return t > 0 ? `${t} ${t === 1 ? 'tarefa' : 'tarefas'}` : null;
    }
    case 'docEntry': {
      const labels: Record<string, string> = {
        visaoGeral: 'Visão geral', reunioes: 'Reuniões', objetivos: 'Objetivos',
        rotina: 'Rotina', cronograma: 'Cronograma', aFazer: 'A Fazer',
      };
      return `Documentação · ${labels[item.data.section] ?? item.data.section}`;
    }
    default:
      return null;
  }
}

// ─── Single trash row ─────────────────────────────────────────────────────────

function TrashRow({ item, onRestore, onDelete }: {
  item: TrashItem;
  onRestore: () => void;
  onDelete: () => void;
}) {
  // An item of an unrecognised type used to break the whole Trash screen,
  // leaving the user unable to even empty it.
  const meta = TYPE_META[item.type] ?? TYPE_META['task'];
  const { elapsed, remaining } = daysInfo(item.deletedAt);
  const name = itemName(item);
  const sub = itemSubline(item);

  const urgency =
    remaining <= 3  ? 'text-red-500'    :
    remaining <= 10 ? 'text-amber-500'  :
                      'text-gray-400';

  return (
    <div className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/60 transition-colors group">
      {/* Type icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.bg} ${meta.color}`}>
        {meta.icon}
      </div>

      {/* Name + subline */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-gray-800 truncate">{name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${meta.bg} ${meta.color}`}>
            {meta.label}
          </span>
          {sub && <span className="text-[11px] text-gray-400">{sub}</span>}
        </div>
      </div>

      {/* Deletion date */}
      <div className="text-right shrink-0 hidden sm:block">
        <p className="text-[11px] text-gray-400">
          {elapsed === 0 ? 'Hoje' : elapsed === 1 ? 'Ontem' : `Há ${elapsed} dias`}
        </p>
        <p className="text-[10px] text-gray-300">{fmtDate(item.deletedAt)}</p>
      </div>

      {/* Days remaining pill */}
      <div className={`text-[11px] font-semibold shrink-0 w-28 text-right ${urgency}`}>
        {remaining <= 0 ? 'Expira hoje' : `${remaining} ${remaining === 1 ? 'dia restante' : 'dias restantes'}`}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          onClick={onRestore}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] font-semibold text-green-600 bg-green-50 hover:bg-green-100 border border-green-100 transition-colors"
        >
          <RotateCcw size={11} />
          Restaurar
        </button>
        <button
          onClick={onDelete}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
          title="Apagar permanentemente"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function TrashView() {
  const { trash, restoreFromTrash, permanentlyDeleteFromTrash, clearTrash, purgeExpiredTrash } = useAppStore();

  // Purge expired on mount
  useEffect(() => { purgeExpiredTrash(); }, []);

  const sorted = [...trash].sort(
    (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
  );

  return (
    <div className="flex-1 overflow-auto bg-[#F5F6F8]">
      <div className="max-w-4xl mx-auto px-8 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-7">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#1f6feb' + '18' }}>
            <Trash2 size={16} style={{ color: '#1f6feb' }} />
          </div>
          <div>
            <h1 className="font-display text-[20px] font-bold text-gray-900 leading-none">Lixeira</h1>
            <p className="text-[12px] text-gray-400 mt-0.5">Itens apagados são mantidos por 30 dias antes de serem removidos permanentemente</p>
          </div>
          {sorted.length > 0 && (
            <button
              onClick={() => { if (window.confirm(`Apagar permanentemente ${sorted.length} ${sorted.length === 1 ? 'item' : 'itens'}? Esta ação não pode ser desfeita.`)) clearTrash(); }}
              className="ml-auto flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold text-red-500 bg-red-50 hover:bg-red-100 border border-red-100 transition-colors"
            >
              <Trash2 size={12} />
              Esvaziar lixeira
            </button>
          )}
        </div>

        {sorted.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-xl border border-gray-100 flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
              <Trash2 size={24} className="text-gray-200" />
            </div>
            <p className="text-[15px] font-semibold text-gray-400">Lixeira vazia</p>
            <p className="text-[13px] text-gray-300 mt-1">Itens apagados aparecerão aqui por 30 dias</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {/* Info bar */}
            <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-100 bg-gray-50/50">
              <AlertTriangle size={12} className="text-amber-500" />
              <span className="text-[12px] text-gray-500">
                <strong>{sorted.length}</strong> {sorted.length === 1 ? 'item' : 'itens'} na lixeira · Serão removidos automaticamente após 30 dias
              </span>
            </div>

            {/* Items */}
            <div className="divide-y divide-gray-100">
              {sorted.map(item => (
                <TrashRow
                  key={item.id}
                  item={item}
                  onRestore={() => restoreFromTrash(item.id)}
                  onDelete={() => permanentlyDeleteFromTrash(item.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
