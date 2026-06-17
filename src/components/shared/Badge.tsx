import type { TaskStatus, TaskPriority, TaskTypeConfig } from '../../types';
import { useAppStore } from '../../store/useAppStore';

const statusConfig: Record<TaskStatus, { bg: string; text: string; dot: string }> = {
  'Backlog':      { bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400'   },
  'Sprint':       { bg: 'bg-violet-50',  text: 'text-violet-700', dot: 'bg-violet-500' },
  'Em andamento': { bg: 'bg-blue-50',    text: 'text-blue-700',   dot: 'bg-blue-500'   },
  'Em revisão':   { bg: 'bg-amber-50',   text: 'text-amber-700',  dot: 'bg-amber-500'  },
  'Bloqueado':    { bg: 'bg-red-50',     text: 'text-red-700',    dot: 'bg-red-500'    },
  'Concluído':    { bg: 'bg-green-50',   text: 'text-green-700',  dot: 'bg-green-500'  },
};

const statusLabel: Record<TaskStatus, string> = {
  'Backlog':      'Backlog',
  'Sprint':       'Sprint',
  'Em andamento': 'Em andamento',
  'Em revisão':   'Em revisão',
  'Bloqueado':    'Bloqueado',
  'Concluído':    'Concluído',
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg = statusConfig[status] ?? statusConfig['Backlog'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {statusLabel[status]}
    </span>
  );
}

const priorityConfig: Record<TaskPriority, { bg: string; text: string }> = {
  'Low':    { bg: 'bg-gray-100',   text: 'text-gray-500'   },
  'Medium': { bg: 'bg-blue-50',    text: 'text-blue-600'   },
  'High':   { bg: 'bg-orange-50',  text: 'text-orange-600' },
  'Urgent': { bg: 'bg-red-50',     text: 'text-red-600'    },
};

const priorityLabel: Record<TaskPriority, string> = {
  'Low':    'Baixa',
  'Medium': 'Média',
  'High':   'Alta',
  'Urgent': 'Urgente',
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const cfg = priorityConfig[priority];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
      {priorityLabel[priority]}
    </span>
  );
}

const LEGACY_CONFIG: Record<string, TaskTypeConfig> = {
  'Video':  { value: 'Video',  label: 'Vídeo',    emoji: '🎬', color: 'bg-red-50 text-red-700'        },
  'Ads':    { value: 'Ads',    label: 'Anúncios', emoji: '📣', color: 'bg-orange-50 text-orange-700'  },
  'SEO':    { value: 'SEO',    label: 'SEO',      emoji: '🔍', color: 'bg-green-50 text-green-700'    },
  'Social': { value: 'Social', label: 'Social',   emoji: '📱', color: 'bg-cyan-50 text-cyan-700'      },
};

const FALLBACK_CONFIG: TaskTypeConfig = { value: '', label: '', emoji: '📋', color: 'bg-gray-100 text-gray-600' };

export function TypeBadge({ type }: { type: string }) {
  const taskTypes = useAppStore(s => s.taskTypes);
  const cfg = taskTypes.find(t => t.value === type) ?? LEGACY_CONFIG[type] ?? { ...FALLBACK_CONFIG, value: type, label: type };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold ${cfg.color}`}>
      <span>{cfg.emoji}</span>
      {cfg.label}
    </span>
  );
}

export function TypeIcon({ type, size = 'sm' }: { type: string; size?: 'sm' | 'md' }) {
  const taskTypes = useAppStore(s => s.taskTypes);
  const cfg = taskTypes.find(t => t.value === type) ?? LEGACY_CONFIG[type] ?? { ...FALLBACK_CONFIG, value: type, label: type };
  return (
    <span className={`inline-flex items-center justify-center rounded-md ${size === 'sm' ? 'w-6 h-6 text-sm' : 'w-8 h-8 text-base'} ${cfg.color} shrink-0`}>
      {cfg.emoji}
    </span>
  );
}
