import { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, Users, GitBranch, Plus, X, Building2, Trash2, ChevronUp, LogOut, CalendarDays, Shield, Search } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { UserPermission } from '../../types';

export interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const PERMISSION_META: Record<UserPermission, { label: string; color: string }> = {
  Admin:        { label: 'Admin',        color: '#ef4444' },
  Gerente:      { label: 'Gerente',      color: '#f97316' },
  Membro:       { label: 'Membro',       color: '#3b82f6' },
  Visualizador: { label: 'Visualizador', color: '#9ca3af' },
  Externo:      { label: 'Externo',      color: '#d1d5db' },
};

// ─── Color palette ────────────────────────────────────────────────────────────

const COMPANY_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#22c55e', '#14b8a6', '#3b82f6',
  '#1f6feb', '#64748b',
];

// ─── New company modal ────────────────────────────────────────────────────────

function NewCompanyModal({ onClose }: { onClose: () => void }) {
  const { addCompany, setActiveCompany } = useAppStore();

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [color, setColor] = useState(COMPANY_COLORS[0]);

  // Auto-generate initials from name
  const logo = name.trim()
    ? name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('')
    : '?';

  const canSubmit = name.trim().length > 0;

  const handleCreate = () => {
    if (!canSubmit) return;
    const id = `c${Date.now()}`;
    addCompany({
      id,
      name: name.trim(),
      industry: industry.trim() || 'Sem setor',
      color,
      logo,
    });
    setActiveCompany(id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 420 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-5 flex items-start justify-between border-b border-gray-100">
          <div className="flex items-center gap-3">
            {/* Live preview of company avatar */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-bold text-white shrink-0 shadow-sm transition-colors"
              style={{ backgroundColor: color }}
            >
              {logo}
            </div>
            <h2 className="text-[15px] font-bold text-[#111]">Nova empresa</h2>
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
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Nome *</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canSubmit) handleCreate(); if (e.key === 'Escape') onClose(); }}
              placeholder="Ex: Velour Studio"
              className="mt-1.5 w-full text-[14px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#1f6feb] transition-colors"
            />
          </div>

          {/* Industry */}
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Setor <span className="font-normal normal-case">(opcional)</span></label>
            <input
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              placeholder="Ex: Fashion & Lifestyle, SaaS / Tech…"
              className="mt-1.5 w-full text-[14px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#1f6feb] transition-colors"
            />
          </div>

          {/* Color */}
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Cor</label>
            <div className="mt-2 flex flex-wrap gap-2.5">
              {COMPANY_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? '#111' : 'transparent',
                    boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Initials preview */}
          {name.trim() && (
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-[14px] font-bold text-white shrink-0 shadow-sm"
                style={{ backgroundColor: color }}
              >
                {logo}
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-800">{name.trim()}</p>
                <p className="text-[11px] text-gray-400">{industry.trim() || 'Sem setor'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={handleCreate}
            disabled={!canSubmit}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: '#1f6feb' }}
          >
            Criar empresa
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-[13px] text-gray-500 hover:bg-gray-100 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { companies, projects, tasks, trash, teamMembers, currentUserId, setCurrentUser, logout, activeCompanyId, activeProjectId, view, setActiveCompany, setActiveProject, setView, setActiveTask, memberAccess, memberCompanyAccess } = useAppStore();

  // Access helpers — Admins see everything
  const currentMember = teamMembers.find(m => m.id === currentUserId);
  const isAdmin = currentMember?.permission === 'Admin';
  const uid = currentUserId ?? '';

  // A project is visible if it's in the explicit memberAccess list.
  // The teamMemberIds fallback that used to sit here made revoking access a
  // no-op in the sidebar: the admin unticked the project, the permissions screen
  // showed it revoked, the dashboard hid it — and the member still saw and opened
  // it here. addProject already grants explicit access to everyone on the team,
  // so the fallback covered nothing except undoing the admin's revocation.
  const visibleProjectIds = isAdmin
    ? projects.map(p => p.id)
    : projects
        .filter(p => {
          const explicit = memberAccess[uid];
          if (!explicit) return true; // no explicit list → see all
          return explicit.includes(p.id);
        })
        .map(p => p.id);

  // A company is visible if it's in memberCompanyAccess OR if the user can see any
  // of its projects (covers newly-created companies/projects).
  const visibleCompanyIds = isAdmin
    ? companies.map(c => c.id)
    : [...new Set([
        ...(memberCompanyAccess[uid] ?? companies.map(c => c.id)),
        ...projects
          .filter(p => visibleProjectIds.includes(p.id))
          .map(p => p.companyId)
          .filter((id): id is string => !!id),
      ])];

  const visibleCompanies = companies.filter(c => visibleCompanyIds.includes(c.id));

  // Wrap navigation actions to auto-close mobile drawer
  const nav = (action: () => void) => () => { action(); onMobileClose(); };
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({ c1: true });
  const [search] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const userPickerRef = useRef<HTMLDivElement>(null);

  // ── Task search ──────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchQuery) return;
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setSearchQuery('');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchQuery]);

  const searchResults = searchQuery.trim().length >= 1
    ? tasks
        .filter(t =>
          !t.parentTaskId &&
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          visibleProjectIds.includes(t.projectId)
        )
        .slice(0, 8)
    : [];

  const STATUS_DOT_SEARCH: Record<string, string> = {
    Backlog:        'bg-gray-400',
    Sprint:         'bg-violet-400',
    'Em andamento': 'bg-blue-400',
    'Em revisão':   'bg-amber-400',
    Bloqueado:      'bg-red-400',
    Concluído:      'bg-green-400',
  };

  useEffect(() => {
    if (!showUserPicker) return;
    const handler = (e: MouseEvent) => {
      if (userPickerRef.current && !userPickerRef.current.contains(e.target as Node))
        setShowUserPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showUserPicker]);

  const currentUser = currentMember;

  const toggle = (id: string) => setExpandedCompanies(p => ({ ...p, [id]: !p[id] }));

  const getHealth = (companyId: string) => {
    const projs = projects.filter(p => p.companyId === companyId);
    const ids = projs.map(p => p.id);
    const all = tasks.filter(t => ids.includes(t.projectId));
    if (!all.length) return 0;
    return Math.round((all.filter(t => t.status === 'Concluído').length / all.length) * 100);
  };

  const getTaskCount = (projectId: string) =>
    tasks.filter(t => t.projectId === projectId && t.status !== 'Concluído').length;

  const isDashboard = view === 'dashboard';

  if (collapsed && !mobileOpen) {
    return (
      <>
        <aside
          className="shrink-0 flex flex-col h-screen sticky top-0 select-none items-center pt-4 gap-3 hidden md:flex"
          style={{ width: '52px', backgroundColor: '#111', borderRight: '1px solid rgba(255,255,255,0.05)', transition: 'width 200ms ease' }}
        >
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#1f6feb' }}
          >
            <span className="text-white font-bold" style={{ fontSize: '14px' }}>M</span>
          </div>
          <button
            onClick={() => setCollapsed(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/8 transition-colors"
          >
            <PanelLeftOpen size={15} />
          </button>
        </aside>
        {showNewCompany && <NewCompanyModal onClose={() => setShowNewCompany(false)} />}
      </>
    );
  }

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`shrink-0 flex flex-col h-screen overflow-y-auto select-none
          fixed inset-y-0 left-0 z-50 transition-transform duration-200
          md:sticky md:top-0 md:z-auto
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{ width: '220px', backgroundColor: '#111', borderRight: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* ── Workspace header ── */}
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-1">
            <button className="flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors min-w-0">
              <img src="/icarus-mark-light.svg" alt="Icarus" className="w-5 h-5 shrink-0" />
              <img src="/icarus-wordmark-light.svg" alt="Icarus" className="h-[18px] shrink-0" style={{ filter: 'brightness(0) invert(1)' }} />
            </button>
            <button
              onClick={() => setCollapsed(true)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-white/25 hover:text-white/60 hover:bg-white/8 transition-colors shrink-0"
            >
              <PanelLeftClose size={14} />
            </button>
          </div>
        </div>

        {/* ── Task search ── */}
        <div ref={searchRef} className="px-3 mb-4 relative">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
            <Search size={13} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setSearchQuery(''); }}
              placeholder="Buscar tarefas..."
              className="flex-1 bg-transparent outline-none min-w-0"
              style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', caretColor: '#1f6feb' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                <X size={12} />
              </button>
            )}
          </div>

          {/* Results dropdown */}
          {searchQuery.trim().length >= 1 && (
            <div
              className="absolute left-3 right-3 top-full mt-1 rounded-xl overflow-hidden z-50"
              style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
            >
              {searchResults.length === 0 ? (
                <p className="px-4 py-3 text-[12px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Nenhuma tarefa encontrada
                </p>
              ) : (
                <div className="py-1 max-h-64 overflow-y-auto">
                  {searchResults.map(task => {
                    const project = projects.find(p => p.id === task.projectId);
                    return (
                      <button
                        key={task.id}
                        onClick={() => {
                          setActiveProject(task.projectId);
                          setTimeout(() => setActiveTask(task.id), 60);
                          setSearchQuery('');
                          onMobileClose();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
                        style={{ backgroundColor: 'transparent' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                      >
                        {/* Status dot */}
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT_SEARCH[task.status] ?? 'bg-gray-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[12px] font-medium truncate ${task.status === 'Concluído' ? 'line-through' : ''}`}
                            style={{ color: task.status === 'Concluído' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)' }}>
                            {task.title}
                          </p>
                          {project && (
                            <p className="text-[10px] truncate mt-0.5 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                              <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: project.color }} />
                              {project.name}
                            </p>
                          )}
                        </div>
                        {task.isMilestone && (
                          <span className="w-2 h-2 rounded-sm rotate-45 shrink-0 bg-[#1f6feb]" style={{ minWidth: 8, minHeight: 8 }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Main nav ── */}
        <nav className="px-3 mb-5 space-y-0.5">
          <button
            onClick={nav(() => { setView('dashboard'); setActiveCompany(null); })}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors"
            style={{
              fontSize: '13px',
              color: isDashboard ? '#fff' : 'rgba(255,255,255,0.6)',
              backgroundColor: isDashboard ? 'rgba(255,255,255,0.08)' : 'transparent',
            }}
            onMouseEnter={e => { if (!isDashboard) { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.9)'; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; } }}
            onMouseLeave={e => { if (!isDashboard) { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)'; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; } }}
          >
            <LayoutDashboard size={15} />
            Início
          </button>
          <button
            onClick={nav(() => setView('schedule'))}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors w-full text-left"
            style={{
              fontSize: '13px',
              color: view === 'schedule' ? '#fff' : 'rgba(255,255,255,0.6)',
              backgroundColor: view === 'schedule' ? 'rgba(255,255,255,0.08)' : 'transparent',
            }}
            onMouseEnter={e => { if (view !== 'schedule') { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.9)'; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; } }}
            onMouseLeave={e => { if (view !== 'schedule') { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)'; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; } }}
          >
            <CalendarDays size={15} />
            Meu Cronograma
          </button>
          {isAdmin && (
            <button
              onClick={nav(() => setView('users'))}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors w-full text-left"
              style={{
                fontSize: '13px',
                color: view === 'users' ? '#fff' : 'rgba(255,255,255,0.6)',
                backgroundColor: view === 'users' ? 'rgba(255,255,255,0.08)' : 'transparent',
              }}
              onMouseEnter={e => { if (view !== 'users') { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.9)'; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; } }}
              onMouseLeave={e => { if (view !== 'users') { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)'; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; } }}
            >
              <Users size={15} />
              Usuários
            </button>
          )}
          <button
            onClick={nav(() => { useAppStore.setState({ activeFlowId: null }); setView('flow'); })}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors w-full text-left"
            style={{
              fontSize: '13px',
              color: view === 'flow' ? '#fff' : 'rgba(255,255,255,0.6)',
              backgroundColor: view === 'flow' ? 'rgba(255,255,255,0.08)' : 'transparent',
            }}
            onMouseEnter={e => { if (view !== 'flow') { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.9)'; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; } }}
            onMouseLeave={e => { if (view !== 'flow') { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)'; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; } }}
          >
            <GitBranch size={15} />
            Fluxos
          </button>
          <button
            onClick={nav(() => setView('backup' as AppView))}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors w-full text-left"
            style={{
              fontSize: '13px',
              color: view === 'backup' ? '#fff' : 'rgba(255,255,255,0.6)',
              backgroundColor: view === 'backup' ? 'rgba(255,255,255,0.08)' : 'transparent',
            }}
            onMouseEnter={e => { if (view !== 'backup') { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.9)'; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; } }}
            onMouseLeave={e => { if (view !== 'backup') { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)'; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; } }}
          >
            <Shield size={15} />
            Backup
          </button>
          <button
            onClick={nav(() => setView('trash'))}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors w-full text-left"
            style={{
              fontSize: '13px',
              color: view === 'trash' ? '#fff' : 'rgba(255,255,255,0.6)',
              backgroundColor: view === 'trash' ? 'rgba(255,255,255,0.08)' : 'transparent',
            }}
            onMouseEnter={e => { if (view !== 'trash') { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.9)'; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; } }}
            onMouseLeave={e => { if (view !== 'trash') { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)'; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; } }}
          >
            <Trash2 size={15} />
            <span className="flex-1">Lixeira</span>
            {trash.length > 0 && (
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
                style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)' }}
              >
                {trash.length}
              </span>
            )}
          </button>
        </nav>

        {/* ── Companies label + add button ── */}
        <div className="px-6 mb-2 flex items-center justify-between">
          <span
            className="uppercase tracking-widest"
            style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.2)' }}
          >
            Empresas
          </span>
          <button
            onClick={() => setShowNewCompany(true)}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
            style={{ color: 'rgba(255,255,255,0.3)' }}
            title="Nova empresa"
          >
            <Plus size={12} />
          </button>
        </div>

        {/* ── Companies ── */}
        <div className="px-3 flex-1 space-y-0.5">
          {visibleCompanies.map(company => {
            const isExpanded = !!expandedCompanies[company.id];
            const isActiveCompany = activeCompanyId === company.id;
            const companyProjects = projects.filter(p => p.companyId === company.id && visibleProjectIds.includes(p.id));
            const health = getHealth(company.id);
            const healthColor = health >= 70 ? '#22c55e' : health >= 40 ? '#f59e0b' : '#ef4444';

            const filteredProjects = companyProjects.filter(p =>
              !search || p.name.toLowerCase().includes(search.toLowerCase())
            );
            const show = !search || filteredProjects.length > 0 ||
              company.name.toLowerCase().includes(search.toLowerCase());

            if (!show) return null;

            return (
              <div key={company.id}>
                {/* Company row */}
                <div
                  className="flex items-center gap-1.5 px-2 py-2 rounded-md cursor-pointer group transition-colors"
                  style={{
                    backgroundColor: isActiveCompany && !activeProjectId ? 'rgba(255,255,255,0.08)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (!(isActiveCompany && !activeProjectId)) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
                  onMouseLeave={e => { if (!(isActiveCompany && !activeProjectId)) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
                >
                  <button
                    onClick={() => toggle(company.id)}
                    className="w-4 h-4 flex items-center justify-center shrink-0 transition-colors"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                  >
                    {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  </button>

                  <button
                    onClick={() => { setActiveCompany(company.id); if (!isExpanded) toggle(company.id); onMobileClose(); }}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    <div
                      className="w-4 h-4 rounded-md flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                      style={{ backgroundColor: company.color }}
                    >
                      {company.logo}
                    </div>
                    <span
                      className="flex-1 truncate"
                      style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}
                    >
                      {company.name}
                    </span>
                  </button>

                  <span className="w-1.5 h-1.5 rounded-full shrink-0 mr-0.5" style={{ backgroundColor: healthColor }} />
                </div>

                {/* Project sub-items */}
                {isExpanded && (
                  <div className="mt-0.5 mb-1.5" style={{ paddingLeft: '24px', paddingRight: '8px' }}>
                    <div className="pl-3 border-l border-white/[0.07]">
                      {filteredProjects.map(project => {
                        const isActive = activeProjectId === project.id;
                        const open = getTaskCount(project.id);
                        return (
                          <button
                            key={project.id}
                            onClick={() => { setActiveProject(project.id); onMobileClose(); }}
                            className="w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-left transition-colors"
                            style={{
                              fontSize: '12px',
                              color: isActive ? '#1f6feb' : 'rgba(255,255,255,0.45)',
                              fontWeight: isActive ? 500 : 400,
                            }}
                            onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)'; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; } }}
                            onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)'; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; } }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                            <span className="flex-1 truncate min-w-0">{project.name}</span>
                            {open > 0 && (
                              <span
                                className="shrink-0 tabular-nums"
                                style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}
                              >
                                {open}
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {/* Inline add project shortcut */}
                      <button
                        onClick={() => {
                          setActiveCompany(company.id);
                          // small delay so company view mounts before modal opens
                          setTimeout(() => {
                            useAppStore.setState({ activeCompanyId: company.id, view: 'company' });
                            // We'll trigger new project via a custom event picked up by CompanyView
                            window.dispatchEvent(new CustomEvent('open-new-project', { detail: { companyId: company.id } }));
                          }, 50);
                        }}
                        className="w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-left transition-colors mt-0.5"
                        style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)'; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                      >
                        <Plus size={11} />
                        <span>Novo projeto</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add company shortcut at bottom of list */}
          <button
            onClick={() => setShowNewCompany(true)}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-md transition-colors mt-1"
            style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)'; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
          >
            <Building2 size={12} />
            <span>Nova empresa</span>
          </button>
        </div>

        {/* ── User footer ── */}
        <div className="p-3 mt-4 relative" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} ref={userPickerRef}>

          {/* User picker popover — Admins only */}
          {isAdmin && showUserPicker && (
            <div
              className="absolute bottom-full left-3 right-3 mb-2 bg-[#1a1a1a] rounded-xl overflow-hidden z-50"
              style={{ border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 -8px 24px rgba(0,0,0,0.4)' }}
            >
              <p className="px-3 py-2 text-[10px] font-bold text-white/30 uppercase tracking-wider border-b border-white/5">
                Entrar como
              </p>
              <div className="py-1 max-h-52 overflow-y-auto">
                {teamMembers.filter(m => m.permission !== 'Externo').map(m => {
                  const perm = (m.permission ?? 'Membro') as UserPermission;
                  const meta = PERMISSION_META[perm];
                  const isActive = m.id === currentUserId;
                  return (
                    <button
                      key={m.id}
                      onClick={() => { setCurrentUser(m.id); setShowUserPicker(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 transition-colors"
                      style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.08)' : 'transparent' }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                        style={{ backgroundColor: m.color }}
                      >
                        {m.avatar}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-[12px] font-medium text-white/80 truncate">{m.name}</p>
                      </div>
                      <span className="text-[10px] font-semibold shrink-0" style={{ color: meta.color }}>{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-1">
            {/* For Admins: clickable to switch users. For others: non-interactive display */}
            {isAdmin ? (
              <button
                onClick={() => setShowUserPicker(v => !v)}
                className="flex-1 flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-white/5 transition-colors min-w-0"
              >
                {currentUser ? (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: currentUser.color, fontSize: '10px', fontWeight: 700, color: '#fff' }}
                  >
                    {currentUser.avatar}
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <Users size={13} className="text-white/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0 text-left">
                  <p className="truncate" style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                    {currentUser?.name ?? 'Selecionar usuário'}
                  </p>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                    {currentUser ? PERMISSION_META[(currentUser.permission ?? 'Membro') as UserPermission].label : '—'}
                  </p>
                </div>
                {showUserPicker
                  ? <ChevronUp size={12} className="text-white/25 shrink-0" />
                  : <ChevronDown size={12} className="text-white/25 shrink-0" />}
              </button>
            ) : (
              <div className="flex-1 flex items-center gap-2.5 px-2 py-2 min-w-0">
                {currentUser && (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: currentUser.color, fontSize: '10px', fontWeight: 700, color: '#fff' }}
                  >
                    {currentUser.avatar}
                  </div>
                )}
                <div className="flex-1 min-w-0 text-left">
                  <p className="truncate" style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                    {currentUser?.name ?? '—'}
                  </p>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                    {currentUser ? PERMISSION_META[(currentUser.permission ?? 'Membro') as UserPermission].label : '—'}
                  </p>
                </div>
              </div>
            )}

            {/* Logout */}
            <button
              onClick={logout}
              title="Sair"
              className="w-7 h-7 flex items-center justify-center rounded-md text-white/20 hover:text-white/60 hover:bg-white/8 transition-colors shrink-0"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {showNewCompany && <NewCompanyModal onClose={() => setShowNewCompany(false)} />}
    </>
  );
}
