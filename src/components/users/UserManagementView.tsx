import { useState } from 'react';
import { Shield, Check, ChevronRight, Users, UserPlus, Trash2, X, Eye, EyeOff, Pencil, Plus, Building2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Avatar } from '../shared/Avatar';
import type { UserPermission, TaskTypeConfig } from '../../types';

// ─── Permission config ────────────────────────────────────────────────────────

const PERMISSIONS: {
  value: UserPermission;
  label: string;
  description: string;
  color: string;
  bg: string;
}[] = [
  {
    value: 'Admin',
    label: 'Admin',
    description: 'Acesso total: deleta empresas, projetos e gerencia permissões',
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
  {
    value: 'Gerente',
    label: 'Gerente',
    description: 'Cria e edita qualquer conteúdo, sem poder deletar empresas',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  {
    value: 'Membro',
    label: 'Membro',
    description: 'Acessa e edita tarefas nos projetos liberados',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    value: 'Visualizador',
    label: 'Visualizador',
    description: 'Somente leitura — não pode editar nenhum conteúdo',
    color: 'text-gray-500',
    bg: 'bg-gray-100',
  },
  {
    value: 'Externo',
    label: 'Externo',
    description: 'Sem acesso ao sistema — apenas para atribuição de tarefas',
    color: 'text-gray-400',
    bg: 'bg-gray-50',
  },
];

const COLOR_OPTIONS = [
  '#1f6feb', '#8B5CF6', '#3B82F6', '#10B981',
  '#F59E0B', '#EF4444', '#06B6D4', '#EC4899',
  '#6366F1', '#84CC16', '#F97316', '#14B8A6',
];

const TYPE_COLORS = [
  { value: 'bg-purple-50 text-purple-700', preview: '#7c3aed' },
  { value: 'bg-pink-50 text-pink-700',     preview: '#db2777' },
  { value: 'bg-orange-50 text-orange-700', preview: '#ea580c' },
  { value: 'bg-blue-50 text-blue-700',     preview: '#2563eb' },
  { value: 'bg-red-50 text-red-700',       preview: '#dc2626' },
  { value: 'bg-cyan-50 text-cyan-700',     preview: '#0891b2' },
  { value: 'bg-indigo-50 text-indigo-700', preview: '#4338ca' },
  { value: 'bg-gray-100 text-gray-700',    preview: '#374151' },
  { value: 'bg-green-50 text-green-700',   preview: '#16a34a' },
  { value: 'bg-yellow-50 text-yellow-700', preview: '#ca8a04' },
  { value: 'bg-teal-50 text-teal-700',     preview: '#0d9488' },
  { value: 'bg-rose-50 text-rose-700',     preview: '#e11d48' },
];

function slugify(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9]/g, '');
}

// ─── Task Type Form Modal ─────────────────────────────────────────────────────

interface TaskTypeFormModalProps {
  initial?: TaskTypeConfig;
  onClose: () => void;
  onSave: (config: TaskTypeConfig) => void;
}

function TaskTypeFormModal({ initial, onClose, onSave }: TaskTypeFormModalProps) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '📋');
  const [color, setColor] = useState(initial?.color ?? TYPE_COLORS[0].value);
  const [error, setError] = useState('');

  const isEdit = !!initial;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) { setError('Nome é obrigatório'); return; }
    if (!emoji.trim()) { setError('Emoji é obrigatório'); return; }
    setError('');
    const value = isEdit ? initial!.value : slugify(label.trim()) || label.trim();
    onSave({ value, label: label.trim(), emoji: emoji.trim(), color });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-[#1f6feb]/10 flex items-center justify-center">
            <Plus size={14} style={{ color: '#1f6feb' }} />
          </div>
          <h2 className="text-[15px] font-bold text-gray-900 flex-1">
            {isEdit ? 'Editar tipo de tarefa' : 'Novo tipo de tarefa'}
          </h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Preview */}
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold ${color}`}>
              <span>{emoji}</span>
              {label || 'Prévia'}
            </span>
          </div>

          {/* Emoji + Label */}
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Emoji</label>
              <input
                value={emoji}
                onChange={e => setEmoji(e.target.value)}
                placeholder="📋"
                maxLength={4}
                className="w-full px-3 py-2 text-[20px] text-center border border-gray-200 rounded-lg focus:outline-none focus:border-[#1f6feb] transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Nome</label>
              <input
                autoFocus
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Ex: Design"
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#1f6feb] transition-colors"
              />
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Cor</label>
            <div className="flex flex-wrap gap-2">
              {TYPE_COLORS.map(c => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className="w-6 h-6 rounded-full transition-all"
                  style={{
                    backgroundColor: c.preview,
                    outline: color === c.value ? `2px solid ${c.preview}` : 'none',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-[12px] text-red-500 font-medium">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-[13px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
              Cancelar
            </button>
            <button type="submit"
              className="flex-1 py-2.5 text-[13px] font-semibold text-white rounded-xl transition-colors"
              style={{ backgroundColor: '#1f6feb' }}>
              {isEdit ? 'Salvar' : 'Criar tipo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function permissionMeta(p?: UserPermission) {
  return PERMISSIONS.find(x => x.value === (p ?? 'Membro')) ?? PERMISSIONS[2];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Add Member Modal ─────────────────────────────────────────────────────────

interface AddMemberModalProps {
  existingEmails: string[];
  onClose: () => void;
  onAdd: (name: string, email: string, role: string, permission: UserPermission, color: string, password: string) => void;
}

function AddMemberModal({ existingEmails, onClose, onAdd }: AddMemberModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [permission, setPermission] = useState<UserPermission>('Membro');
  const [color, setColor] = useState(COLOR_OPTIONS[2]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  const preview = name.trim() ? getInitials(name) : '?';

  const isExterno = permission === 'Externo';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Nome é obrigatório'); return; }
    if (!isExterno) {
      if (!email.trim() || !email.includes('@')) { setError('E-mail inválido'); return; }
      // login() matches by email with find(), so a duplicate address means the new
      // member can never sign in — the first holder always wins.
      if (existingEmails.includes(email.trim().toLowerCase())) { setError('Já existe um membro com este e-mail'); return; }
      if (!role.trim()) { setError('Cargo é obrigatório'); return; }
      if (password.length < 4) { setError('Senha deve ter ao menos 4 caracteres'); return; }
      if (password !== confirm) { setError('As senhas não conferem'); return; }
    }
    setError('');
    onAdd(name.trim(), isExterno ? '' : email.trim(), isExterno ? '' : role.trim(), permission, color, isExterno ? '' : password);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-[#1f6feb]/10 flex items-center justify-center">
            <UserPlus size={14} style={{ color: '#1f6feb' }} />
          </div>
          <h2 className="text-[15px] font-bold text-gray-900 flex-1">Novo membro</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Avatar preview + color */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-[15px] shrink-0 transition-colors"
              style={{ backgroundColor: color }}>
              {preview}
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Cor do avatar</p>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_OPTIONS.map(c => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setColor(c)}
                    className="w-5 h-5 rounded-full transition-all"
                    style={{
                      backgroundColor: c,
                      outline: color === c ? `2px solid ${c}` : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Name */}
          <div className={isExterno ? '' : 'grid grid-cols-2 gap-3'}>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Nome</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Maria Silva"
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#1f6feb] transition-colors bg-white text-gray-900"
              />
            </div>
            {!isExterno && (
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Cargo</label>
                <input
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  placeholder="Ex: Designer"
                  className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#1f6feb] transition-colors bg-white text-gray-900"
                />
              </div>
            )}
          </div>

          {!isExterno && (
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="nome@empresa.com"
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#1f6feb] transition-colors bg-white text-gray-900"
              />
            </div>
          )}

          {isExterno && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-gray-400 mt-0.5">ℹ️</span>
              <p className="text-[12px] text-gray-500 leading-relaxed">
                Usuário externo — aparece como opção de responsável em tarefas, mas não tem acesso ao sistema.
              </p>
            </div>
          )}

          {/* Permission */}
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Permissão</label>
            <div className="grid grid-cols-2 gap-2">
              {PERMISSIONS.map(perm => (
                <button
                  type="button"
                  key={perm.value}
                  onClick={() => setPermission(perm.value)}
                  className={`text-left px-3 py-2 rounded-xl border-2 transition-all ${
                    permission === perm.value
                      ? 'border-[#1f6feb] bg-[#1f6feb]/5'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <span className={`text-[11px] font-bold ${permission === perm.value ? 'text-[#1f6feb]' : 'text-gray-700'}`}>
                    {perm.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Password — hidden for Externo */}
          {!isExterno && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Senha</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 4 chars"
                    className="w-full px-3 py-2 pr-9 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#1f6feb] transition-colors bg-white text-gray-900"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Confirmar</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repita a senha"
                  className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#1f6feb] transition-colors bg-white text-gray-900"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-[12px] text-red-500 font-medium">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-[13px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
              Cancelar
            </button>
            <button type="submit"
              className="flex-1 py-2.5 text-[13px] font-semibold text-white rounded-xl transition-colors"
              style={{ backgroundColor: '#1f6feb' }}>
              Criar membro
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Member Modal ────────────────────────────────────────────────────────

interface EditMemberModalProps {
  member: { id: string; name: string; email: string; role: string; color: string; permission?: UserPermission };
  onClose: () => void;
  onSave: (id: string, data: { name: string; email: string; role: string; color: string }, newPassword?: string) => void;
}

function EditMemberModal({ member, onClose, onSave }: EditMemberModalProps) {
  const [name,     setName]     = useState(member.name);
  const [email,    setEmail]    = useState(member.email ?? '');
  const [role,     setRole]     = useState(member.role ?? '');
  const [color,    setColor]    = useState(member.color);
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');

  const isExterno = member.permission === 'Externo';
  const preview   = name.trim() ? getInitials(name) : '?';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Nome é obrigatório'); return; }
    if (!isExterno && email && !email.includes('@')) { setError('E-mail inválido'); return; }
    if (password && password.length < 4) { setError('Senha deve ter ao menos 4 caracteres'); return; }
    if (password && password !== confirm) { setError('As senhas não conferem'); return; }
    setError('');
    onSave(member.id, { name: name.trim(), email: email.trim(), role: role.trim(), color }, password || undefined);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-[#1f6feb]/10 flex items-center justify-center">
            <Pencil size={14} style={{ color: '#1f6feb' }} />
          </div>
          <h2 className="text-[15px] font-bold text-gray-900 flex-1">Editar membro</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Avatar preview + color */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-[15px] shrink-0 transition-colors"
              style={{ backgroundColor: color }}>
              {preview}
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Cor do avatar</p>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_OPTIONS.map(c => (
                  <button type="button" key={c} onClick={() => setColor(c)}
                    className="w-5 h-5 rounded-full transition-all"
                    style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Name + Role */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Nome</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Maria Silva"
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#1f6feb] transition-colors" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                Cargo {isExterno && <span className="font-normal normal-case text-gray-400">(opcional)</span>}
              </label>
              <input value={role} onChange={e => setRole(e.target.value)} placeholder="Ex: Designer"
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#1f6feb] transition-colors" />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              E-mail {isExterno && <span className="font-normal normal-case text-gray-400">(opcional)</span>}
            </label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@empresa.com"
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#1f6feb] transition-colors" />
          </div>

          {/* Password — optional change */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                Nova senha <span className="font-normal normal-case text-gray-400">(opcional)</span>
              </label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Deixe em branco p/ manter"
                  className="w-full px-3 py-2 pr-9 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#1f6feb] transition-colors" />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Confirmar</label>
              <input type={showPw ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Repita a senha"
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#1f6feb] transition-colors" />
            </div>
          </div>

          {error && <p className="text-[12px] text-red-500 font-medium">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-[13px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
              Cancelar
            </button>
            <button type="submit"
              className="flex-1 py-2.5 text-[13px] font-semibold text-white rounded-xl transition-colors"
              style={{ backgroundColor: '#1f6feb' }}>
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirmation ──────────────────────────────────────────────────────

interface DeleteConfirmProps {
  memberName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteConfirm({ memberName, onCancel, onConfirm }: DeleteConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-sm mx-4 p-6">
        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={18} className="text-red-500" />
        </div>
        <h3 className="text-[15px] font-bold text-gray-900 text-center mb-2">Apagar membro?</h3>
        <p className="text-[13px] text-gray-500 text-center leading-relaxed mb-6">
          <span className="font-semibold text-gray-700">{memberName}</span> será removido da equipe.
          Todas as tarefas atribuídas a ele(a) serão desatribuídas. Esta ação não pode ser desfeita.
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-2.5 text-[13px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors">
            Apagar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function UserManagementView() {
  const {
    teamMembers, projects, companies,
    memberAccess, setMemberProjectAccess, setMemberAllAccess,
    memberCompanyAccess, setMemberCompanyAccess, setMemberAllCompanyAccess,
    updateMemberPermission, currentUserId,
    addTeamMember, updateTeamMember, deleteTeamMember,
    teams, addTeam, updateTeam, deleteTeam, addPersonToTeam, removePersonFromTeam,
    taskTypes, addTaskType, updateTaskType, deleteTaskType,
    tasks,
  } = useAppStore();

  const [activeTab,       setActiveTab]       = useState<'members' | 'teams' | 'types'>('members');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(teamMembers[0]?.id ?? null);
  const [selectedTeamId,  setSelectedTeamId]  = useState<string | null>(null);
  const [showAddModal,    setShowAddModal]     = useState(false);
  const [editTarget,      setEditTarget]       = useState<string | null>(null);
  const [deleteTarget,    setDeleteTarget]     = useState<string | null>(null);
  // New-team inline form
  const [newTeamName,     setNewTeamName]      = useState('');
  const [newTeamColor,    setNewTeamColor]     = useState(COLOR_OPTIONS[0]);
  const [newTeamCompany,  setNewTeamCompany]   = useState<string>('');
  const [showNewTeam,     setShowNewTeam]      = useState(false);
  // Edit-team inline
  // null = not renaming. Using '' as the flag meant clearing the field exited
  // edit mode mid-typing, so the name could never be retyped from scratch.
  const [editingTeamName, setEditingTeamName]  = useState<string | null>(null);
  // Task types tab
  const [showTypeForm,    setShowTypeForm]     = useState(false);
  const [editingType,     setEditingType]      = useState<TaskTypeConfig | null>(null);
  const [typeDeleteWarn,  setTypeDeleteWarn]   = useState<string | null>(null);

  const currentUser = teamMembers.find(m => m.id === currentUserId);
  const isAdmin = currentUser?.permission === 'Admin';

  const selectedMember = teamMembers.find(m => m.id === selectedMemberId);
  const deleteTargetMember = teamMembers.find(m => m.id === deleteTarget);

  const getMemberProjectIds = (memberId: string): string[] =>
    memberAccess[memberId] ?? projects.map(p => p.id);

  const getMemberCompanyIds = (memberId: string): string[] =>
    memberCompanyAccess[memberId] ?? companies.map(c => c.id);

  const hasAccess = (memberId: string, projectId: string) =>
    getMemberProjectIds(memberId).includes(projectId);

  const hasCompanyAccess = (memberId: string, companyId: string) =>
    getMemberCompanyIds(memberId).includes(companyId);

  const companyAccessCount = (memberId: string) =>
    getMemberCompanyIds(memberId).length;

  function handleAdd(
    name: string, email: string, role: string,
    permission: UserPermission, color: string, password: string
  ) {
    addTeamMember({ name, email, role, avatar: getInitials(name), color, permission }, password);
    setShowAddModal(false);
  }

  function handleEdit(id: string, data: { name: string; email: string; role: string; color: string }, newPassword?: string) {
    updateTeamMember(id, { ...data, avatar: getInitials(data.name) }, newPassword);
    setEditTarget(null);
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    deleteTeamMember(deleteTarget);
    if (selectedMemberId === deleteTarget) setSelectedMemberId(null);
    setDeleteTarget(null);
  }

  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  function createTeam() {
    if (!newTeamName.trim()) return;
    addTeam(newTeamName.trim(), newTeamColor, newTeamCompany || undefined);
    setNewTeamName('');
    setNewTeamColor(COLOR_OPTIONS[0]);
    setNewTeamCompany('');
    setShowNewTeam(false);
  }

  return (
    <div className="flex-1 overflow-auto bg-[#F5F6F8]">
      <div className="max-w-5xl mx-auto px-8 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#1f6feb' + '18' }}>
            <Shield size={16} style={{ color: '#1f6feb' }} />
          </div>
          <div>
            <h1 className="font-display text-[20px] font-bold text-gray-900 leading-none">Gestão de Usuários</h1>
            <p className="text-[12px] text-gray-400 mt-0.5">Defina o nível de acesso e os projetos de cada membro</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[12px] text-gray-400 bg-white border border-gray-100 rounded-lg px-3 py-1.5">
              <Users size={12} />
              <span>{teamMembers.length} membros · {projects.length} projetos</span>
            </div>
            {isAdmin && activeTab === 'members' && (
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white rounded-lg transition-colors"
                style={{ backgroundColor: '#1f6feb' }}
              >
                <UserPlus size={12} />
                Novo membro
              </button>
            )}
            {isAdmin && activeTab === 'teams' && (
              <button
                onClick={() => setShowNewTeam(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white rounded-lg transition-colors"
                style={{ backgroundColor: '#1f6feb' }}
              >
                <Plus size={12} />
                Nova equipe
              </button>
            )}
            {isAdmin && activeTab === 'types' && (
              <button
                onClick={() => { setEditingType(null); setShowTypeForm(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white rounded-lg transition-colors"
                style={{ backgroundColor: '#1f6feb' }}
              >
                <Plus size={12} />
                Adicionar tipo
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-white border border-gray-100 rounded-xl p-1 w-fit">
          {([
            ['members', 'Membros', null] as const,
            ['teams',   'Equipes', teams.length > 0 ? teams.length : null] as const,
            ['types',   'Tipos',   taskTypes.length > 0 ? taskTypes.length : null] as const,
          ]).map(([tab, label, count]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
              style={activeTab === tab
                ? { backgroundColor: '#1f6feb', color: '#fff' }
                : { color: '#9ca3af' }}
            >
              {label}
              {count !== null && (
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══ TEAMS TAB ══════════════════════════════════════════════════════ */}
        {activeTab === 'teams' && (
          <div className="flex gap-5">
            {/* Left: teams list */}
            <div className="w-72 shrink-0 space-y-2">
              {/* New team form */}
              {showNewTeam && (
                <div className="bg-white rounded-xl border border-[#1f6feb]/30 p-4 space-y-3">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Nova equipe</p>
                  <input
                    autoFocus
                    value={newTeamName}
                    onChange={e => setNewTeamName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') createTeam(); if (e.key === 'Escape') setShowNewTeam(false); }}
                    placeholder="Nome da equipe..."
                    className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#1f6feb] transition-colors"
                  />
                  {/* Company association */}
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Empresa (opcional)</p>
                    <select
                      value={newTeamCompany}
                      onChange={e => setNewTeamCompany(e.target.value)}
                      className="w-full px-3 py-2 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#1f6feb] transition-colors bg-white text-gray-700"
                    >
                      <option value="">Sem empresa associada</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {newTeamCompany && (
                      <p className="text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2 py-1.5 mt-1.5">
                        Gerentes desta equipe terão poder de Admin na empresa selecionada
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_OPTIONS.map(c => (
                      <button key={c} onClick={() => setNewTeamColor(c)}
                        className="w-5 h-5 rounded-full transition-all"
                        style={{ backgroundColor: c, outline: newTeamColor === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }} />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowNewTeam(false)}
                      className="flex-1 py-2 text-[12px] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                      Cancelar
                    </button>
                    <button onClick={createTeam} disabled={!newTeamName.trim()}
                      className="flex-1 py-2 text-[12px] font-semibold text-white rounded-lg transition-colors disabled:opacity-40"
                      style={{ backgroundColor: '#1f6feb' }}>
                      Criar
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {teams.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <p className="text-[13px] text-gray-400">Nenhuma equipe criada</p>
                    <button onClick={() => setShowNewTeam(true)}
                      className="mt-3 text-[12px] font-semibold text-[#1f6feb] hover:underline">
                      + Criar primeira equipe
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {teams.map(team => {
                      const members = teamMembers.filter(m => team.memberIds.includes(m.id));
                      const isSelected = selectedTeamId === team.id;
                      return (
                        <button key={team.id} onClick={() => setSelectedTeamId(team.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${isSelected ? 'bg-orange-50/60' : 'hover:bg-gray-50'}`}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-[13px]"
                            style={{ backgroundColor: team.color }}>
                            {team.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] font-semibold truncate ${isSelected ? 'text-[#1f6feb]' : 'text-gray-800'}`}>{team.name}</p>
                            <p className="text-[11px] text-gray-400">{members.length} {members.length === 1 ? 'membro' : 'membros'}</p>
                          </div>
                          <ChevronRight size={13} className={isSelected ? 'text-[#1f6feb]' : 'text-gray-300'} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: team detail */}
            <div className="flex-1 min-w-0">
              {selectedTeam ? (() => {
                const teamMemberList = teamMembers.filter(m => selectedTeam.memberIds.includes(m.id));
                const available = teamMembers.filter(m => !selectedTeam.memberIds.includes(m.id));
                const isEditing = editingTeamName !== null;
                return (
                  <div className="space-y-4">
                    {/* Team header card */}
                    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-[16px] shrink-0"
                        style={{ backgroundColor: selectedTeam.color }}>
                        {selectedTeam.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <input
                            autoFocus
                            value={editingTeamName ?? ''}
                            onChange={e => setEditingTeamName(e.target.value)}
                            onBlur={() => {
                              if (editingTeamName?.trim()) updateTeam(selectedTeam.id, { name: editingTeamName.trim() });
                              setEditingTeamName(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { if (editingTeamName?.trim()) updateTeam(selectedTeam.id, { name: editingTeamName.trim() }); setEditingTeamName(null); }
                              if (e.key === 'Escape') setEditingTeamName(null);
                            }}
                            className="text-[16px] font-bold text-gray-900 bg-transparent border-b-2 border-[#1f6feb] outline-none w-full"
                          />
                        ) : (
                          <p className="text-[16px] font-bold text-gray-900">{selectedTeam.name}</p>
                        )}
                        <p className="text-[12px] text-gray-400 mt-0.5">{teamMemberList.length} {teamMemberList.length === 1 ? 'membro' : 'membros'}</p>
                      </div>
                      {/* Company badge + selector */}
                      <div className="flex flex-col gap-1.5 min-w-[160px]">
                        {selectedTeam.companyId ? (() => {
                          const linkedCompany = companies.find(c => c.id === selectedTeam.companyId);
                          return linkedCompany ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-white w-fit"
                              style={{ backgroundColor: linkedCompany.color }}>
                              <Building2 size={9} />
                              {linkedCompany.name}
                              <span className="opacity-70">— Admin</span>
                            </div>
                          ) : null;
                        })() : (
                          <span className="text-[10px] text-gray-400 italic">Sem empresa associada</span>
                        )}
                        {isAdmin && (
                          <select
                            value={selectedTeam.companyId ?? ''}
                            onChange={e => updateTeam(selectedTeam.id, { companyId: e.target.value || undefined })}
                            className="text-[11px] border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 focus:outline-none focus:border-[#1f6feb] transition-colors cursor-pointer"
                          >
                            <option value="">Sem empresa</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        )}
                      </div>

                    {/* Color swatches */}
                      <div className="flex flex-wrap gap-1.5 max-w-[120px]">
                        {COLOR_OPTIONS.slice(0, 8).map(c => (
                          <button key={c} onClick={() => updateTeam(selectedTeam.id, { color: c })}
                            className="w-4 h-4 rounded-full transition-all"
                            style={{ backgroundColor: c, outline: selectedTeam.color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }} />
                        ))}
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => setEditingTeamName(selectedTeam.name)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg transition-colors">
                            <Pencil size={12} /> Renomear
                          </button>
                          <button onClick={() => { deleteTeam(selectedTeam.id); setSelectedTeamId(null); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-red-500 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg transition-colors">
                            <Trash2 size={12} /> Apagar
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Current members */}
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-100">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Membros da equipe</p>
                      </div>
                      {teamMemberList.length === 0 ? (
                        <div className="px-6 py-8 text-center text-[13px] text-gray-400">
                          Nenhum membro ainda. Adicione abaixo.
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {teamMemberList.map(m => {
                            const meta = permissionMeta(m.permission);
                            return (
                              <div key={m.id} className="flex items-center gap-3 px-6 py-3.5 group">
                                <Avatar member={m} size="md" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-semibold text-gray-800 truncate">{m.name}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${meta.bg} ${meta.color}`}>{meta.label}</span>
                                    {m.role && <span className="text-[11px] text-gray-400 truncate">{m.role}</span>}
                                  </div>
                                </div>
                                {isAdmin && (
                                  <button onClick={() => removePersonFromTeam(selectedTeam.id, m.id)}
                                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-all">
                                    <X size={11} /> Remover
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Available to add */}
                    {isAdmin && available.length > 0 && (
                      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100">
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Adicionar à equipe</p>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {available.map(m => {
                            const meta = permissionMeta(m.permission);
                            return (
                              <div key={m.id} className="flex items-center gap-3 px-6 py-3.5 group hover:bg-gray-50/50 transition-colors">
                                <Avatar member={m} size="md" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-semibold text-gray-700 truncate">{m.name}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${meta.bg} ${meta.color}`}>{meta.label}</span>
                                    {m.role && <span className="text-[11px] text-gray-400 truncate">{m.role}</span>}
                                  </div>
                                </div>
                                <button onClick={() => addPersonToTeam(selectedTeam.id, m.id)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#1f6feb] bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100">
                                  <Plus size={11} /> Adicionar
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div className="bg-white rounded-xl border border-gray-100 flex flex-col items-center justify-center h-64 gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <Users size={18} className="text-gray-300" />
                  </div>
                  <p className="text-[13px] text-gray-400">Selecione uma equipe para ver os detalhes</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ TYPES TAB ══════════════════════════════════════════════════════ */}
        {activeTab === 'types' && (
          <div className="max-w-xl">
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tipos de Tarefa</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Gerencie os tipos disponíveis ao criar e editar tarefas</p>
              </div>

              {taskTypes.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-[13px] text-gray-400">Nenhum tipo cadastrado</p>
                  <button
                    onClick={() => { setEditingType(null); setShowTypeForm(true); }}
                    className="mt-3 text-[12px] font-semibold text-[#1f6feb] hover:underline"
                  >
                    + Criar primeiro tipo
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {taskTypes.map(tt => {
                    const inUseCount = tasks.filter(t => t.type === tt.value).length;
                    return (
                      <div key={tt.value} className="flex items-center gap-4 px-6 py-3.5 group hover:bg-gray-50/50 transition-colors">
                        {/* Badge preview */}
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold shrink-0 ${tt.color}`}>
                          <span>{tt.emoji}</span>
                          {tt.label}
                        </span>

                        {/* value key */}
                        <span className="text-[11px] text-gray-400 font-mono">{tt.value}</span>

                        <div className="flex-1" />

                        {/* In-use count */}
                        {inUseCount > 0 && (
                          <span className="text-[11px] text-gray-400 shrink-0">
                            {inUseCount} {inUseCount === 1 ? 'tarefa' : 'tarefas'}
                          </span>
                        )}

                        {/* Actions */}
                        {isAdmin && (
                          <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={() => { setEditingType(tt); setShowTypeForm(true); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                              <Pencil size={11} /> Editar
                            </button>
                            <button
                              onClick={() => {
                                if (inUseCount > 0) {
                                  setTypeDeleteWarn(tt.value);
                                } else {
                                  deleteTaskType(tt.value);
                                }
                              }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                            >
                              <Trash2 size={11} /> Apagar
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Delete warning for in-use types */}
            {typeDeleteWarn && (() => {
              const tt = taskTypes.find(t => t.value === typeDeleteWarn);
              const count = tasks.filter(t => t.type === typeDeleteWarn).length;
              return tt ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-sm mx-4 p-6">
                    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                      <Trash2 size={18} className="text-red-500" />
                    </div>
                    <h3 className="text-[15px] font-bold text-gray-900 text-center mb-2">Apagar tipo?</h3>
                    <p className="text-[13px] text-gray-500 text-center leading-relaxed mb-6">
                      O tipo <span className="font-semibold text-gray-700">{tt.label}</span> está sendo usado em{' '}
                      <span className="font-semibold text-red-600">{count} {count === 1 ? 'tarefa' : 'tarefas'}</span>.
                      Apagá-lo não afeta as tarefas existentes, mas o tipo não aparecerá mais nas opções.
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setTypeDeleteWarn(null)}
                        className="flex-1 py-2.5 text-[13px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                        Cancelar
                      </button>
                      <button onClick={() => { deleteTaskType(typeDeleteWarn); setTypeDeleteWarn(null); }}
                        className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors">
                        Apagar mesmo assim
                      </button>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        )}

        {/* ══ MEMBERS TAB ════════════════════════════════════════════════════ */}
        {activeTab === 'members' && (
        <div className="flex gap-5">
          {/* Left: Member list */}
          <div className="w-72 shrink-0">
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Membros</p>
              </div>
              <div className="divide-y divide-gray-100">
                {teamMembers.map(member => {
                  const compCount = companyAccessCount(member.id);
                  const isSelected = selectedMemberId === member.id;
                  const meta = permissionMeta(member.permission);
                  return (
                    <button
                      key={member.id}
                      onClick={() => setSelectedMemberId(member.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${isSelected ? 'bg-orange-50/60' : 'hover:bg-gray-50'}`}
                    >
                      <Avatar member={member} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] font-semibold truncate ${isSelected ? 'text-[#1f6feb]' : 'text-gray-800'}`}>{member.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${meta.bg} ${meta.color}`}>
                            {meta.label}
                          </span>
                          <span className="text-[11px] text-gray-400 truncate">{member.role}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${compCount === companies.length ? 'bg-green-50 text-green-600' : compCount === 0 ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'}`}>
                          {compCount}/{companies.length}
                        </span>
                        <ChevronRight size={13} className={isSelected ? 'text-[#1f6feb]' : 'text-gray-300'} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Details for selected member */}
          <div className="flex-1 min-w-0 space-y-4">
            {selectedMember ? (
              <>
                {/* ── Permission level card ── */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <Avatar member={selectedMember} size="lg" />
                    <div className="flex-1">
                      <p className="text-[15px] font-bold text-gray-900">{selectedMember.name}</p>
                      <p className="text-[12px] text-gray-400">{selectedMember.role}</p>
                      {selectedMember.email && (
                        <p className="text-[11px] text-gray-400 mt-0.5">{selectedMember.email}</p>
                      )}
                    </div>
                    {/* Action buttons — Admin only */}
                    {isAdmin && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setEditTarget(selectedMember.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg transition-colors"
                        >
                          <Pencil size={12} />
                          Editar
                        </button>
                        {selectedMember.id !== currentUserId && (
                          <button
                            onClick={() => setDeleteTarget(selectedMember.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-red-500 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg transition-colors"
                          >
                            <Trash2 size={12} />
                            Apagar
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="px-6 py-5">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Nível de acesso</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {PERMISSIONS.map(perm => {
                        const isSelected = (selectedMember.permission ?? 'Membro') === perm.value;
                        return (
                          <button
                            key={perm.value}
                            onClick={() => updateMemberPermission(selectedMember.id, perm.value)}
                            className={`relative text-left p-3.5 rounded-xl border-2 transition-all ${
                              isSelected
                                ? 'border-[#1f6feb] bg-[#1f6feb]/5'
                                : 'border-gray-100 hover:border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className={`text-[12px] font-bold ${isSelected ? 'text-[#1f6feb]' : 'text-gray-700'}`}>
                                {perm.label}
                              </span>
                              {isSelected && (
                                <div className="w-4 h-4 rounded-full bg-[#1f6feb] flex items-center justify-center">
                                  <Check size={9} className="text-white" strokeWidth={3} />
                                </div>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-400 leading-snug">{perm.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ── Company & project access card ── */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                        {selectedMember.permission === 'Externo' ? 'Projetos onde pode ser responsável' : 'Acesso a empresas e projetos'}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {selectedMember.permission === 'Externo'
                          ? 'Ative a empresa para que este externo apareça como opção nos projetos'
                          : 'Ative a empresa para liberar seus projetos individualmente'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setMemberAllCompanyAccess(selectedMember.id, true)}
                        className="px-3 py-1.5 text-[12px] font-semibold text-green-600 bg-green-50 hover:bg-green-100 border border-green-100 rounded-lg transition-colors"
                      >
                        Liberar tudo
                      </button>
                      <button
                        onClick={() => setMemberAllCompanyAccess(selectedMember.id, false)}
                        className="px-3 py-1.5 text-[12px] font-semibold text-red-500 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg transition-colors"
                      >
                        Revogar tudo
                      </button>
                    </div>
                  </div>

                  {/* Companies + nested projects */}
                  <div className="divide-y divide-gray-100">
                    {companies.map(company => {
                      const companyProjects = projects.filter(p => p.companyId === company.id);
                      const companyOn = hasCompanyAccess(selectedMember.id, company.id);
                      const accessibleProjects = companyProjects.filter(p => hasAccess(selectedMember.id, p.id));

                      return (
                        <div key={company.id}>
                          {/* Company row */}
                          <div className={`flex items-center gap-4 px-6 py-4 ${companyOn ? 'bg-gray-50/30' : 'bg-gray-50/70'}`}>
                            {/* Toggle switch */}
                            <button
                              onClick={() => setMemberCompanyAccess(selectedMember.id, company.id, !companyOn)}
                              className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${companyOn ? 'bg-[#1f6feb]' : 'bg-gray-200'}`}
                            >
                              <span
                                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
                                style={{ transform: companyOn ? 'translateX(18px)' : 'translateX(2px)' }}
                              />
                            </button>

                            {/* Logo */}
                            <span
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                              style={{ backgroundColor: companyOn ? company.color : '#9CA3AF' }}
                            >
                              {company.logo}
                            </span>

                            {/* Name + summary */}
                            <div className="flex-1 min-w-0">
                              <p className={`text-[13px] font-bold ${companyOn ? 'text-gray-800' : 'text-gray-400'}`}>{company.name}</p>
                              <p className="text-[11px] text-gray-400">
                                {companyOn
                                  ? `${accessibleProjects.length} de ${companyProjects.length} ${companyProjects.length === 1 ? 'projeto' : 'projetos'} com acesso`
                                  : `${companyProjects.length} ${companyProjects.length === 1 ? 'projeto bloqueado' : 'projetos bloqueados'}`}
                              </p>
                            </div>

                            {/* Status badge */}
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${companyOn ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                              {companyOn ? 'Ativo' : 'Bloqueado'}
                            </span>
                          </div>

                          {/* Project rows — only shown when company is ON */}
                          {companyOn && companyProjects.map(project => {
                            const granted = hasAccess(selectedMember.id, project.id);
                            return (
                              <div
                                key={project.id}
                                className="flex items-center gap-4 px-6 py-3.5 pl-[4.5rem] hover:bg-gray-50/60 transition-colors border-t border-gray-50"
                              >
                                <button
                                  onClick={() => setMemberProjectAccess(selectedMember.id, project.id, !granted)}
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${granted ? 'border-[#1f6feb] bg-[#1f6feb]' : 'border-gray-300 bg-white hover:border-gray-400'}`}
                                >
                                  {granted && <Check size={11} className="text-white" strokeWidth={2.5} />}
                                </button>
                                <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: project.color }} />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-[13px] font-semibold truncate ${granted ? 'text-gray-800' : 'text-gray-400'}`}>{project.name}</p>
                                  {project.description && (
                                    <p className="text-[11px] text-gray-400 truncate">{project.description}</p>
                                  )}
                                </div>
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${granted ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                  {granted ? 'Acesso' : 'Sem acesso'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 flex items-center justify-center h-64">
                <p className="text-[13px] text-gray-400">Selecione um membro para gerenciar o acesso</p>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddMemberModal
          existingEmails={teamMembers.map(m => (m.email ?? '').toLowerCase()).filter(Boolean)}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
        />
      )}
      {editTarget && (() => {
        const m = teamMembers.find(tm => tm.id === editTarget);
        return m ? (
          <EditMemberModal
            member={m}
            onClose={() => setEditTarget(null)}
            onSave={handleEdit}
          />
        ) : null;
      })()}
      {deleteTarget && deleteTargetMember && (
        <DeleteConfirm
          memberName={deleteTargetMember.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
      {showTypeForm && (
        <TaskTypeFormModal
          initial={editingType ?? undefined}
          onClose={() => { setShowTypeForm(false); setEditingType(null); }}
          onSave={(cfg) => {
            if (editingType) {
              updateTaskType(editingType.value, cfg);
            } else {
              addTaskType(cfg);
            }
            setShowTypeForm(false);
            setEditingType(null);
          }}
        />
      )}
    </div>
  );
}
