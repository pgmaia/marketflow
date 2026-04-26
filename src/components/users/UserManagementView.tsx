import { useState } from 'react';
import { Shield, Check, ChevronRight, Users } from 'lucide-react';
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

function permissionMeta(p?: UserPermission) {
  return PERMISSIONS.find(x => x.value === (p ?? 'Membro')) ?? PERMISSIONS[2];
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function UserManagementView() {
  const {
    teamMembers, projects, companies,
    memberAccess, setMemberProjectAccess, setMemberAllAccess,
    updateMemberPermission,
  } = useAppStore();

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(teamMembers[0]?.id ?? null);

  const selectedMember = teamMembers.find(m => m.id === selectedMemberId);

  const getMemberProjectIds = (memberId: string): string[] =>
    memberAccess[memberId] ?? projects.map(p => p.id);

  const hasAccess = (memberId: string, projectId: string) =>
    getMemberProjectIds(memberId).includes(projectId);

  const accessCount = (memberId: string) =>
    getMemberProjectIds(memberId).length;

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
          <div className="ml-auto flex items-center gap-1.5 text-[12px] text-gray-400 bg-white border border-gray-100 rounded-lg px-3 py-1.5">
            <Users size={12} />
            <span>{teamMembers.length} membros · {projects.length} projetos</span>
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
                    </div>
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
    </div>
  );
}
