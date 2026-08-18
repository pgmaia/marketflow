import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { UserPermission } from '../../types';
import { MEMBER_PASSWORDS } from '../../data/seed';

const PERMISSION_COLORS: Record<UserPermission, string> = {
  Admin:        '#ef4444',
  Gerente:      '#f97316',
  Membro:       '#3b82f6',
  Visualizador: '#9ca3af',
  Externo:      '#d1d5db',
};

export function LoginView() {
  const { login, teamMembers } = useAppStore();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const matchedMember = teamMembers.find(
    m => m.email?.toLowerCase() === email.trim().toLowerCase()
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');
    setTimeout(() => {
      const ok = login(email, password);
      if (!ok) { setError('E-mail ou senha incorretos.'); setPassword(''); }
      setLoading(false);
    }, 400);
  };

  return (
    <div className="w-full min-h-screen flex" style={{ fontFamily: "'Geist', -apple-system, system-ui, sans-serif" }}>

      {/* ── Left brand panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between flex-[46%] p-11 relative overflow-hidden"
        style={{ background: '#0a1626' }}
      >
        {/* Wordmark */}
        <img src="/icarus-wordmark-light.svg" alt="Icarus" style={{ height: 28, width: 'auto', filter: 'brightness(0) invert(1)', alignSelf: 'flex-start' }} />

        {/* Hero copy */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: 42, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.08, color: '#fff', maxWidth: '11ch', margin: 0 }}>
            Leve o marketing mais alto.
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', marginTop: 18, lineHeight: 1.55, maxWidth: '34ch' }}>
            Tarefas, projetos e equipe — tudo em um só lugar, do briefing à entrega.
          </p>
        </div>

        {/* Footer */}
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', position: 'relative', zIndex: 1, margin: 0 }}>
          © 2026 Icarus · Plataforma de gestão de marketing
        </p>

        {/* Oversized faint brand mark */}
        <img
          src="/icarus-mark-light.svg"
          alt=""
          aria-hidden="true"
          style={{ position: 'absolute', right: -70, bottom: -60, width: 360, opacity: 0.05, pointerEvents: 'none' }}
        />
      </div>

      {/* ── Right form panel ── */}
      <div
        className="flex-1 flex items-center justify-center p-8"
        style={{ background: '#f5f7fa' }}
      >
        <div style={{ width: '100%', maxWidth: 360 }}>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <img src="/icarus-mark.svg" alt="Icarus" style={{ height: 28 }} />
            <img src="/icarus-wordmark.svg" alt="Icarus" style={{ height: 22 }} />
          </div>

          {/* Heading */}
          <h2 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: '#161a21', margin: 0 }}>
            {matchedMember ? `Olá, ${matchedMember.name.split(' ')[0]}` : 'Entrar na sua conta'}
          </h2>
          <p style={{ fontSize: 14, color: '#6b7484', marginTop: 6, marginBottom: 28 }}>
            {matchedMember ? 'Continue de onde parou.' : 'Bem-vindo de volta. Continue de onde parou.'}
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Email */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#4d5562' }}>E-mail</span>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  placeholder="seu@email.com"
                  autoFocus
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    height: 40, padding: '0 12px',
                    paddingRight: matchedMember ? 44 : 12,
                    fontSize: 14, color: '#161a21',
                    background: '#fff',
                    border: `1px solid ${error ? '#e5484d' : '#dbe1ea'}`,
                    borderRadius: 6, outline: 'none',
                    transition: 'border-color 120ms',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#1f6feb'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = error ? '#e5484d' : '#dbe1ea'; }}
                />
                {matchedMember && (
                  <div
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      width: 24, height: 24, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700, color: '#fff',
                      backgroundColor: matchedMember.color,
                    }}
                  >
                    {matchedMember.avatar}
                  </div>
                )}
              </div>
            </label>

            {/* Password */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#4d5562' }}>Senha</span>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    height: 40, padding: '0 40px 0 12px',
                    fontSize: 14, color: '#161a21',
                    background: '#fff',
                    border: `1px solid ${error ? '#e5484d' : '#dbe1ea'}`,
                    borderRadius: 6, outline: 'none',
                    transition: 'border-color 120ms',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#1f6feb'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = error ? '#e5484d' : '#dbe1ea'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    color: '#98a2b3', display: 'flex',
                  }}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {/* Error */}
            {error && (
              <p style={{ fontSize: 13, color: '#cb2c31', margin: 0 }}>{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              style={{
                height: 40, borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, color: '#fff',
                backgroundColor: loading || !email.trim() || !password ? '#93bbfd' : '#1f6feb',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background-color 120ms',
                marginTop: 4,
              }}
              onMouseEnter={e => { if (!loading && email.trim() && password) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1a5bd0'; }}
              onMouseLeave={e => { if (!loading && email.trim() && password) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1f6feb'; }}
            >
              {loading
                ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'block' }} />
                : 'Entrar'
              }
            </button>
          </form>

          {/* Demo credentials — DEV ONLY.
              This listed every seed member and filled in their real password on
              click, including the Admin's, on a publicly reachable URL. It also
              went stale the moment an admin changed a password, filling in the
              old one and reporting "senha incorreta". */}
          {import.meta.env.DEV && (
          <div style={{ marginTop: 28, borderTop: '1px solid #eef1f6', paddingTop: 20 }}>
            <button
              onClick={() => setShowDemo(v => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 0 12px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: '#98a2b3',
              }}
            >
              <span>Credenciais de demonstração</span>
              <span style={{ fontSize: 10 }}>{showDemo ? '▲' : '▼'}</span>
            </button>

            {showDemo && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {teamMembers.filter(m => m.permission !== 'Externo').map(m => {
                  const perm = (m.permission ?? 'Membro') as UserPermission;
                  return (
                    <button
                      key={m.id}
                      onClick={() => { setEmail(m.email); setPassword(MEMBER_PASSWORDS[m.id] ?? ''); setError(''); setShowDemo(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 10px', borderRadius: 6, border: '1px solid #eef1f6',
                        background: '#fff', cursor: 'pointer', textAlign: 'left',
                        transition: 'border-color 120ms',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#dbe1ea'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#eef1f6'; }}
                    >
                      <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', backgroundColor: m.color }}>
                        {m.avatar}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: '#232831', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</p>
                        <p style={{ fontSize: 11, color: '#98a2b3', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</p>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, flexShrink: 0, color: PERMISSION_COLORS[perm] }}>{perm}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
