import { useEffect, useMemo, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import type { DocSection } from '../../types';
import { DOC_SECTIONS } from '../../types';
import { useAppStore } from '../../store/useAppStore';

interface Props {
  projectId: string;
  projectColor?: string;
}

/** Relative label for recent posts, absolute date once that stops being useful. */
function timeLabel(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const mins = Math.floor((Date.now() - then.getTime()) / 60000);
  if (mins < 1)   return 'agora';
  if (mins < 60)  return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ontem';
  if (days < 7)   return `há ${days} dias`;
  return then.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fullStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Composer for one section. The parent gives it a key per project+section, so
 *  switching sections remounts it and it picks up that section's own parked
 *  draft through lazy initial state — no state-syncing effect involved. */
function Composer({
  draftKey, sectionLabel, accent, onPost,
}: { draftKey: string; sectionLabel: string; accent: string; onPost: (text: string) => void }) {
  const [draft, setDraft] = useState(() => localStorage.getItem(draftKey) ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Text typed but not yet published is parked in localStorage, so changing
  // section, leaving the view or reloading never costs the user what they wrote.
  useEffect(() => {
    if (draft) localStorage.setItem(draftKey, draft);
    else localStorage.removeItem(draftKey);
  }, [draft, draftKey]);

  const post = () => {
    const text = draft.trim();
    if (!text) return;
    onPost(text);
    setDraft('');
    localStorage.removeItem(draftKey);
    textareaRef.current?.focus();
  };

  return (
    <div className="border border-gray-200 rounded-xl focus-within:border-[#1f6feb]/50 transition-colors overflow-hidden">
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); post(); }
        }}
        rows={3}
        placeholder={`Escrever em ${sectionLabel}…`}
        className="w-full px-4 py-3 text-[13px] text-gray-800 outline-none resize-y leading-relaxed placeholder:text-gray-300"
      />
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-gray-100 bg-gray-50/60">
        <span className="text-[11px] text-gray-400">
          Cada envio vira um registro permanente. ⌘/Ctrl + Enter para publicar.
        </span>
        <button
          onClick={post}
          disabled={!draft.trim()}
          className="h-7 flex items-center gap-1.5 px-3 rounded-md text-[12px] font-semibold text-white transition-opacity disabled:opacity-30 shrink-0"
          style={{ backgroundColor: accent }}
        >
          <Send size={12} />
          Publicar
        </button>
      </div>
    </div>
  );
}

export function ProjectDocsView({ projectId, projectColor }: Props) {
  const { docEntries, teamMembers, currentUserId, addDocEntry } = useAppStore();
  const [section, setSection] = useState<DocSection>('visaoGeral');

  const memberById = useMemo(
    () => Object.fromEntries(teamMembers.map(m => [m.id, m])),
    [teamMembers]
  );

  // Newest first — this reads as a chat, most recent at the top.
  const entries = useMemo(
    () => docEntries
      .filter(e => e.projectId === projectId && e.section === section)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)),
    [docEntries, projectId, section]
  );

  const countsBySection = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const e of docEntries) {
      if (e.projectId !== projectId) continue;
      acc[e.section] = (acc[e.section] ?? 0) + 1;
    }
    return acc;
  }, [docEntries, projectId]);

  const accent = projectColor ?? '#1f6feb';
  const current = DOC_SECTIONS.find(s => s.id === section);

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-white">

      {/* Section tabs */}
      <div className="shrink-0 border-b border-gray-100 px-4 md:px-12 pt-3 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {DOC_SECTIONS.map(s => {
            const active = s.id === section;
            const n = countsBySection[s.id] ?? 0;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-t-md border-b-2 transition-colors whitespace-nowrap ${
                  active ? 'border-current' : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
                }`}
                style={active ? { color: accent } : undefined}
              >
                {s.label}
                {n > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${active ? '' : 'bg-gray-100 text-gray-400'}`}
                    style={active ? { backgroundColor: `${accent}1a`, color: accent } : undefined}
                  >
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Composer + log */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-5">

          {current && <p className="text-[12px] text-gray-400">{current.hint}</p>}

          {/* Composer sits on top because the newest entry lands right below it */}
          <Composer
            key={`${projectId}-${section}`}
            draftKey={`icarus-doc-draft-${projectId}-${section}`}
            sectionLabel={current?.label ?? 'esta seção'}
            accent={accent}
            onPost={text => addDocEntry(projectId, section, text)}
          />

          {/* Entries — newest first */}
          {entries.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-[13px] text-gray-400">Nada registrado em {current?.label} ainda.</p>
              <p className="text-[12px] text-gray-300 mt-1">O primeiro registro aparece aqui.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map(entry => {
                const author = entry.authorId ? memberById[entry.authorId] : undefined;
                const mine = !!entry.authorId && entry.authorId === currentUserId;
                return (
                  <div
                    key={entry.id}
                    className="flex gap-3 rounded-xl border border-gray-100 px-4 py-3 hover:border-gray-200 transition-colors"
                  >
                    <div
                      className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-white mt-0.5"
                      style={{ backgroundColor: author?.color ?? '#9ca3af' }}
                      title={author?.name ?? 'Desconhecido'}
                    >
                      {author?.avatar ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-[12px] font-semibold text-gray-800">
                          {author?.name ?? 'Usuário removido'}
                        </span>
                        {mine && (
                          <span className="text-[10px] font-semibold text-gray-300 uppercase tracking-wide">você</span>
                        )}
                        <span className="text-[11px] text-gray-400" title={fullStamp(entry.createdAt)}>
                          {timeLabel(entry.createdAt)}
                        </span>
                      </div>
                      {/* whitespace-pre-wrap keeps the line breaks the author typed */}
                      <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap break-words mt-1">
                        {entry.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
