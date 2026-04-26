import type { TaskStatus, TaskPriority, TaskType } from '../../types';

const statusConfig: Record<TaskStatus, { bg: string; text: string; dot: string }> = {
  'Not Started': { bg: 'bg-gray-100',   text: 'text-gray-600',  dot: 'bg-gray-400'  },
  'In Progress': { bg: 'bg-blue-50',    text: 'text-blue-700',  dot: 'bg-blue-500'  },
  'Review':      { bg: 'bg-amber-50',   text: 'text-amber-700', dot: 'bg-amber-500' },
  'Done':        { bg: 'bg-green-50',   text: 'text-green-700', dot: 'bg-green-500' },
  'Blocked':     { bg: 'bg-red-50',     text: 'text-red-700',   dot: 'bg-red-500'   },
};

const statusLabel: Record<TaskStatus, string> = {
  'Not Started': 'Não iniciado',
  'In Progress': 'Em andamento',
  'Review':      'Em revisão',
  'Done':        'Concluído',
  'Blocked':     'Bloqueado',
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg = statusConfig[status];
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

const typeConfig: Record<TaskType, { emoji: string; color: string; label: string }> = {
  'Copy':      { emoji: '✍️', color: 'bg-purple-50 text-purple-700', label: 'Copy'      },
  'Design':    { emoji: '🎨', color: 'bg-pink-50 text-pink-700',     label: 'Design'    },
  'Video':     { emoji: '🎬', color: 'bg-red-50 text-red-700',       label: 'Vídeo'     },
  'Ads':       { emoji: '📣', color: 'bg-orange-50 text-orange-700', label: 'Anúncios'  },
  'SEO':       { emoji: '🔍', color: 'bg-green-50 text-green-700',   label: 'SEO'       },
  'Email':     { emoji: '📧', color: 'bg-blue-50 text-blue-700',     label: 'E-mail'    },
  'Social':    { emoji: '📱', color: 'bg-cyan-50 text-cyan-700',     label: 'Social'    },
  'Analytics': { emoji: '📊', color: 'bg-indigo-50 text-indigo-700', label: 'Analytics' },
  'Meeting':   { emoji: '🗓️', color: 'bg-gray-100 text-gray-700',   label: 'Reunião'   },
};

export function TypeBadge({ type }: { type: TaskType }) {
  const cfg = typeConfig[type];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold ${cfg.color}`}>
      <span>{cfg.emoji}</span>
      {cfg.label}
    </span>
  );
}

export function TypeIcon({ type, size = 'sm' }: { type: TaskType; size?: 'sm' | 'md' }) {
  const cfg = typeConfig[type];
  return (
    <span className={`inline-flex items-center justify-center rounded-md ${size === 'sm' ? 'w-6 h-6 text-sm' : 'w-8 h-8 text-base'} ${cfg.color} shrink-0`}>
      {cfg.emoji}
    </span>
  );
}
