import { useState } from 'react';
import { Shield, Check, ChevronRight, Users, UserPlus, Trash2, X, Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Avatar } from '../shared/Avatar';
import type { UserPermission } from '../../types';

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
];

const COLOR_OPTIONS = [
  '#FF5C35', '#8B5CF6', '#3B82F6', '#10B981',
  '#F59E0B', '#EF4444', '#06B6D4', '#EC4899',
  '#6366F1', '#84CC16', '#F97316', '#14B8A6',
];

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
  onClose: () => void;
  onAdd: (name: string, email: string, role: string, permission: UserPermission, color: string, password: string) => void;
}

function AddMemberModal({ onClose, onAdd }: AddMemberModalProps) {
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Nome é obrigatório'); return; }
    if (!email.trim() || !email.includes('@')) { setError('E-mail inválido'); return; }
    if (!role.trim()) { setError('Cargo é obrigatório'); return; }
    if (password.length < 4) { setError('Senha deve ter ao menos 4 caracteres'); return; }
    if (password !== confirm) { setError('As senhas não conferem'); return; }
    setError('');
    onAdd(name.trim(), email.trim(), role.trim(), permission, color, password);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-[#FF5C35]/10 flex items-center justify-center">
            <UserPlus size={14} style={{ color: '#FF5C35' }} />
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

          {/* Name + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Nome</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Maria Silva"
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#FF5C35] transition-colors bg-white text-gray-900"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Cargo</label>
              <input
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder="Ex: Designer"
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#FF5C35] transition-colors bg-white text-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nome@empresa.com"
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#FF5C35] transition-colors bg-white text-gray-900"
            />
          </div>

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
                      ? 'border-[#FF5C35] bg-[#FF5C35]/5'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <span className={`text-[11px] font-bold ${permission === perm.value ? 'text-[#FF5C35]' : 'text-gray-700'}`}>
                    {perm.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Password */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Senha</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 4 chars"
                  className="w-full px-3 py-2 pr-9 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#FF5C35] transition-colors bg-white text-gray-900"
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
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#FF5C35] transition-colors bg-white text-gray-900"
              />
            </div>
          </div>

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
              style={{ backgroundColor: '#FF5C35' }}>
              Criar membro
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
    updateMemberPermission, currentUserId,
    addTeamMember, deleteTeamMember,
  } = useAppStore();

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(teamMembers[0]?.id ?? null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const currentUser = teamMembers.find(m => m.id === currentUserId);
  const isAdmin = currentUser?.permission === 'Admin';

  const selectedMember = teamMembers.find(m => m.id === selectedMemberId);
  const deleteTargetMember = teamMembers.find(m => m.id === deleteTarget);

  const getMemberProjectIds = (memberId: string): string[] =>
    memberAccess[memberId] ?? projects.map(p => p.id);

  const hasAccess = (memberId: string, projectId: string) =>
    getMemberProjectIds(memberId).includes(projectId);

  const accessCount = (memberId: string) =>
    getMemberProjectIds(memberId).length;

  function handleAdd(
    name: string, email: string, role: string,
    permission: UserPermission, color: string, password: string
  ) {
    addTeamMember({ name, email, role, avatar: getInitials(name), color, permission }, password);
    setShowAddModal(false);
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    deleteTeamMember(deleteTarget);
    if (selectedMemberId === deleteTarget) setSelectedMemberId(null);
    setDeleteTarget(null);
  }

  return (
    <div className="flex-1 overflow-auto bg-[#F5F6F8]">
      <div className="max-w-5xl mx-auto px-8 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-7">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#FF5C35' + '18' }}>
            <Shield size={16} style={{ color: '#FF5C35' }} />
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
            {isAdmin && (
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white rounded-lg transition-colors"
                style={{ backgroundColor: '#FF5C35' }}
              >
                <UserPlus size={12} />
                Novo membro
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-5">
          {/* Left: Member list */}
          <div className="w-72 shrink-0">
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Membros</p>
              </div>
              <div className="divide-y divide-gray-100">
                {teamMembers.map(member => {
                  const count = accessCount(member.id);
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
                        <p className={`text-[13px] font-semibold truncate ${isSelected ? 'text-[#FF5C35]' : 'text-gray-800'}`}>{member.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${meta.bg} ${meta.color}`}>
                            {meta.label}
                          </span>
                          <span className="text-[11px] text-gray-400 truncate">{member.role}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${count === projects.length ? 'bg-green-50 text-green-600' : count === 0 ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'}`}>
                          {count}/{projects.length}
                        </span>
                        <ChevronRight size={13} className={isSelected ? 'text-[#FF5C35]' : 'text-gray-300'} />
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
                    {/* Delete button — Admin only, not for self */}
                    {isAdmin && selectedMember.id !== currentUserId && (
                      <button
                        onClick={() => setDeleteTarget(selectedMember.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-red-500 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg transition-colors"
                      >
                        <Trash2 size={12} />
                        Apagar membro
                      </button>
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
                                ? 'border-[#FF5C35] bg-[#FF5C35]/5'
                                : 'border-gray-100 hover:border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className={`text-[12px] font-bold ${isSelected ? 'text-[#FF5C35]' : 'text-gray-700'}`}>
                                {perm.label}
                              </span>
                              {isSelected && (
                                <div className="w-4 h-4 rounded-full bg-[#FF5C35] flex items-center justify-center">
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

                {/* ── Project access card ── */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Acesso a projetos</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setMemberAllAccess(selectedMember.id, true)}
                        className="px-3 py-1.5 text-[12px] font-semibold text-green-600 bg-green-50 hover:bg-green-100 border border-green-100 rounded-lg transition-colors"
                      >
                        Liberar todos
                      </button>
                      <button
                        onClick={() => setMemberAllAccess(selectedMember.id, false)}
                        className="px-3 py-1.5 text-[12px] font-semibold text-red-500 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg transition-colors"
                      >
                        Revogar todos
                      </button>
                    </div>
                  </div>

                  {/* Projects grouped by company */}
                  <div className="divide-y divide-gray-100">
                    {companies.map(company => {
                      const companyProjects = projects.filter(p => p.companyId === company.id);
                      if (!companyProjects.length) return null;
                      const allGranted = companyProjects.every(p => hasAccess(selectedMember.id, p.id));
                      const noneGranted = companyProjects.every(p => !hasAccess(selectedMember.id, p.id));

                      return (
                        <div key={company.id}>
                          <div className="flex items-center justify-between px-6 py-3 bg-gray-50/60">
                            <div className="flex items-center gap-2.5">
                              <span className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: company.color }}>{company.logo}</span>
                              <span className="text-[12px] font-bold text-gray-600">{company.name}</span>
                              <span className="text-[11px] text-gray-400">{companyProjects.length} projetos</span>
                            </div>
                            <button
                              onClick={() => companyProjects.forEach(p => setMemberProjectAccess(selectedMember.id, p.id, !allGranted))}
                              className={`text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors ${allGranted ? 'text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                            >
                              {allGranted ? 'Revogar empresa' : noneGranted ? 'Liberar empresa' : 'Liberar todos'}
                            </button>
                          </div>

                          {companyProjects.map(project => {
                            const granted = hasAccess(selectedMember.id, project.id);
                            return (
                              <div
                                key={project.id}
                                className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/60 transition-colors"
                              >
                                <button
                                  onClick={() => setMemberProjectAccess(selectedMember.id, project.id, !granted)}
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${granted ? 'border-[#FF5C35] bg-[#FF5C35]' : 'border-gray-300 bg-white hover:border-gray-400'}`}
                                >
                                  {granted && <Check size={11} className="text-white" strokeWidth={2.5} />}
                                </button>
                                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: project.color }} />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-[13px] font-semibold truncate ${granted ? 'text-gray-800' : 'text-gray-400'}`}>{project.name}</p>
                                  <p className="text-[11px] text-gray-400 truncate">{project.description}</p>
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
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
        />
      )}
      {deleteTarget && deleteTargetMember && (
        <DeleteConfirm
          memberName={deleteTargetMember.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}
