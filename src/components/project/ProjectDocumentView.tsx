import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, Underline, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote,
  Minus, Undo2, Redo2, Check,
} from 'lucide-react';

interface Props {
  projectId: string;
  initialContent: string;
  onSave: (content: string) => void;
  projectColor?: string;
}

type SaveState = 'saved' | 'saving' | 'unsaved';

// ── Formatting helpers ───────────────────────────────────────────────────────

function execFmt(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

function isActive(cmd: string) {
  try { return document.queryCommandState(cmd); } catch { return false; }
}

// ── Toolbar button ───────────────────────────────────────────────────────────

function ToolBtn({
  icon: Icon, title, active, onMouseDown,
}: {
  icon: React.ElementType;
  title: string;
  active?: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      title={title}
      onMouseDown={onMouseDown}
      className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors
        ${active
          ? 'bg-[#1f6feb]/10 text-[#1f6feb]'
          : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
        }`}
    >
      <Icon size={14} />
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function ProjectDocumentView({ projectId: _projectId, initialContent, onSave, projectColor }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [, forceRender] = useState(0); // for toolbar active state

  // Seed content on mount / project change
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialContent || '';
    }
    setSaveState('saved');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_projectId]);

  // ── Auto-save ──────────────────────────────────────────────────────────────

  const scheduleSave = useCallback(() => {
    setSaveState('unsaved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (!editorRef.current) return;
      setSaveState('saving');
      const html = editorRef.current.innerHTML;
      saveTimerRef.current = undefined;
      onSave(html);
      setSaveState('saved');
    }, 800);
  }, [onSave]);

  // Keep the latest onSave reachable from the unmount cleanup without making
  // the cleanup re-run (and lose the pending timer) every time it changes.
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Switching tabs or projects unmounts this view. Without flushing, anything
  // typed in the last 800 ms is dropped: the timer fires after unmount, finds
  // editorRef.current === null and returns without ever calling onSave.
  useEffect(() => {
    return () => {
      if (!saveTimerRef.current) return;
      clearTimeout(saveTimerRef.current);
      // Cleanup runs before the DOM node is detached, so this is still readable.
      if (editorRef.current) onSaveRef.current(editorRef.current.innerHTML);
    };
  }, []);

  // ── Format helpers ─────────────────────────────────────────────────────────

  const fmt = useCallback((cmd: string, value?: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    editorRef.current?.focus();
    execFmt(cmd, value);
    forceRender(n => n + 1);
    scheduleSave();
  }, [scheduleSave]);

  const insertDivider = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    editorRef.current?.focus();
    execFmt('insertHTML', '<hr/><p><br></p>');
    scheduleSave();
  }, [scheduleSave]);

  // ── Auto-link helpers ──────────────────────────────────────────────────────

  const URL_PATTERN = /^https?:\/\/[^\s<>"{}|\\^`[\]]{2,}$/;

  /** Try to auto-link the word immediately before the cursor. Returns true if a link was inserted. */
  const tryAutoLink = useCallback((insertAfter: string): boolean => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false;

    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return false;

    const text = node.textContent ?? '';
    const cursorPos = range.startOffset;
    const textBefore = text.slice(0, cursorPos);
    const lastSpace = textBefore.lastIndexOf(' ');
    const word = textBefore.slice(lastSpace + 1);

    if (!URL_PATTERN.test(word)) return false;

    // Select the URL word
    const linkRange = document.createRange();
    linkRange.setStart(node, lastSpace + 1);
    linkRange.setEnd(node, cursorPos);
    sel.removeAllRanges();
    sel.addRange(linkRange);

    // Replace with anchor + trailing char
    const safe = word.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    execFmt('insertHTML',
      `<a href="${word}" target="_blank" rel="noopener noreferrer">${safe}</a>${insertAfter}`
    );
    scheduleSave();
    return true;
  }, [scheduleSave]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Cmd/Ctrl shortcuts
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'b') { e.preventDefault(); execFmt('bold'); forceRender(n => n + 1); }
      if (e.key === 'i') { e.preventDefault(); execFmt('italic'); forceRender(n => n + 1); }
      if (e.key === 'u') { e.preventDefault(); execFmt('underline'); forceRender(n => n + 1); }
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); execFmt('undo'); }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); execFmt('redo'); }
      return;
    }

    // Auto-link on Space — insert space after link
    if (e.key === ' ') {
      if (tryAutoLink(' ')) { e.preventDefault(); return; }
    }

    // Auto-link on Enter — let contenteditable create the new paragraph normally,
    // but first linkify the word before cursor
    if (e.key === 'Enter') {
      tryAutoLink(''); // cursor moves into new paragraph via native Enter
    }
  }, [tryAutoLink]);

  // ── Paste — convert pasted plain-text URLs to links ───────────────────────

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const plain = e.clipboardData.getData('text/plain');
    if (!plain) return;
    if (!/https?:\/\//.test(plain)) return; // no URLs — let browser handle normally

    e.preventDefault();

    // Escape HTML, then linkify URLs, then convert newlines
    const html = plain
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/https?:\/\/[^\s<>"{}|\\^`[\]]+/g,
        url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)
      .replace(/\n/g, '<br>');

    execFmt('insertHTML', html);
    scheduleSave();
  }, [scheduleSave]);

  const accentColor = projectColor ?? '#1f6feb';

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 bg-[#FAFAFA]">

      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-0.5 px-6 py-2 bg-white border-b border-gray-100 flex-wrap">

        {/* Undo / Redo */}
        <ToolBtn icon={Undo2} title="Desfazer (⌘Z)" onMouseDown={fmt('undo')} />
        <ToolBtn icon={Redo2} title="Refazer (⌘⇧Z)" onMouseDown={fmt('redo')} />

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Headings */}
        <ToolBtn icon={Heading1} title="Título 1" onMouseDown={fmt('formatBlock', 'h1')} />
        <ToolBtn icon={Heading2} title="Título 2" onMouseDown={fmt('formatBlock', 'h2')} />
        <ToolBtn icon={Heading3} title="Título 3" onMouseDown={fmt('formatBlock', 'h3')} />

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Inline */}
        <ToolBtn icon={Bold}          title="Negrito (⌘B)"    active={isActive('bold')}          onMouseDown={fmt('bold')} />
        <ToolBtn icon={Italic}        title="Itálico (⌘I)"    active={isActive('italic')}        onMouseDown={fmt('italic')} />
        <ToolBtn icon={Underline}     title="Sublinhado (⌘U)" active={isActive('underline')}     onMouseDown={fmt('underline')} />
        <ToolBtn icon={Strikethrough} title="Tachado"         active={isActive('strikeThrough')} onMouseDown={fmt('strikeThrough')} />

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Lists */}
        <ToolBtn icon={List}        title="Lista com marcadores" active={isActive('insertUnorderedList')} onMouseDown={fmt('insertUnorderedList')} />
        <ToolBtn icon={ListOrdered} title="Lista numerada"       active={isActive('insertOrderedList')}   onMouseDown={fmt('insertOrderedList')} />

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Block extras */}
        <ToolBtn icon={Quote} title="Citação" onMouseDown={fmt('formatBlock', 'blockquote')} />
        <ToolBtn icon={Minus} title="Linha divisória" onMouseDown={insertDivider} />

        {/* Save indicator */}
        <div className="ml-auto flex items-center gap-1.5 text-[11px] font-medium shrink-0">
          {saveState === 'saved' && (
            <span className="flex items-center gap-1 text-gray-400">
              <Check size={11} />
              Salvo
            </span>
          )}
          {saveState === 'saving' && <span className="text-gray-400">Salvando…</span>}
          {saveState === 'unsaved' && <span className="text-amber-400">Não salvo</span>}
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-3xl mx-auto py-10 px-6 md:px-0">

          {/* Accent bar */}
          <div className="w-10 h-1 rounded-full mb-6" style={{ backgroundColor: accentColor }} />

          {/* Contenteditable */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={scheduleSave}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onMouseUp={() => forceRender(n => n + 1)}
            onKeyUp={() => forceRender(n => n + 1)}
            className="outline-none min-h-[60vh] text-[15px] text-gray-800 leading-relaxed project-doc-editor"
            data-placeholder="Comece a escrever o histórico do projeto…"
          />
        </div>
      </div>
    </div>
  );
}
