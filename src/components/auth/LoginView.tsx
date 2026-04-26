import { useState } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { UserPermission } from '../../types';
import { MEMBER_PASSWORDS } from '../../data/seed';

const PERMISSION_COLORS: Record<UserPermission, string> = {
  Admin:        '#ef4444',
  Gerente:      '#f97316',
  Membro:       '#3b82f6',
  Visualizador: '#9ca3af',
};

export function LoginView() {
  const { login, teamMembers } = useAppStore();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  // Find matching member as user types email (for avatar preview)
  const matchedMember = teamMembers.find(
    m => m.email?.toLowerCase() === email.trim().toLowerCase()
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError('');

    // Tiny artificial delay for UX feel
    setTimeout(() => {
      const ok = login(email, password);
      if (!ok) {
        setError('E-mail ou senha incorretos.');
        setPassword('');
      }
      setLoading(false);
    }, 400);
  };

  return (
    <div
      className="w-full min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#0d0d0d' }}
    >
      {/* Background grid lines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 600, height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,92,53,0.12) 0%, transparent 70%)',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      <div className="relative w-full max-w-sm mx-4">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-lg"
            style={{ backgroundColor: '#FF5C35' }}
          >
            <span className="text-white font-bold text-[22px] tracking-tight">M</span>
          </div>
          <h1 className="text-white font-bold text-[22px] tracking-tight">MarketFlow</h1>
          <p className="text-white/30 text-[13px] mt-1">Sua plataforma de marketing</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="px-7 pt-7 pb-6">
            <h2 className="text-white text-[16px] font-semibold mb-1">
              {matchedMember ? `Olá, ${matchedMember.name.split(' ')[0]} 👋` : 'Bem-vindo de volta'}
            </h2>
            <p className="text-white/35 text-[13px] mb-6">
              Entre com suas credenciais para continuar
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                  E-mail
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    placeholder="seu@email.com"
                    autoFocus
                    className="w-full text-[14px] text-white placeholder-white/20 rounded-xl px-4 py-3 outline-none transition-all"
                    style={{
                      backgroundColor: '#252525',
                      border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#FF5C35'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'; }}
                  />
                  {/* Matched member avatar */}
                  {matchedMember && (
                    <div
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                      style={{ backgroundColor: matchedMember.color }}
                    >
                      {matchedMember.avatar}
                    </div>
                  )}
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder="••••••••"
                    className="w-full text-[14px] text-white placeholder-white/20 rounded-xl px-4 py-3 pr-11 outline-none transition-all"
                    style={{
                      backgroundColor: '#252525',
                      border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#FF5C35'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <p className="text-[12px] text-red-400 font-medium">{error}</p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-semibold text-white transition-all mt-2 disabled:opacity-40"
                style={{ backgroundColor: '#FF5C35' }}
                onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e54e2a'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FF5C35'; }}
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn size={15} />
                    Entrar
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Demo credentials */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => setShowDemo(v => !v)}
              className="w-full flex items-center justify-between px-7 py-3 text-[12px] text-white/25 hover:text-white/40 transition-colors"
            >
              <span>Credenciais de demonstração</span>
              <span className="text-[10px]">{showDemo ? '▲' : '▼'}</span>
            </button>

            {showDemo && (
              <div className="px-7 pb-5 space-y-2">
                {teamMembers.map(m => {
                  const perm = (m.permission ?? 'Membro') as UserPermission;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        setEmail(m.email);
                        setPassword(MEMBER_PASSWORDS[m.id] ?? '');
                        setError('');
                        setShowDemo(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors text-left"
                      style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.07)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                        style={{ backgroundColor: m.color }}
                      >
                        {m.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-white/70 font-medium truncate">{m.name}</p>
                        <p className="text-[10px] text-white/25 truncate">{m.email}</p>
                      </div>
                      <span
                        className="text-[10px] font-semibold shrink-0"
                        style={{ color: PERMISSION_COLORS[perm] }}
                      >
                        {perm}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-white/15 text-[11px] mt-6">
          MarketFlow · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
