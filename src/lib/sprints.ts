// ── Sprints quinzenais ───────────────────────────────────────────────────────
// Duas por mês: dias 1–15 = /1, dia 16 até o fim = /2. O valor canônico é
// "YYYY-MM-S" (ex.: "2026-09-2") — ordena lexicograficamente e não confunde
// janeiros de anos diferentes; o rótulo segue o padrão do time ("Sprint set/2"),
// mostrando o ano só quando não é o corrente.

export const SPRINT_MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function sprintOfDate(d: Date): string {
  const half = d.getDate() <= 15 ? 1 : 2;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${half}`;
}

export const currentSprint = () => sprintOfDate(new Date());

export function sprintLabel(s: string, opts?: { short?: boolean }): string {
  const m = s.match(/^(\d{4})-(\d{2})-([12])$/);
  if (!m) return s;
  const year = +m[1];
  const base = `${SPRINT_MONTHS[+m[2] - 1]}/${m[3]}`;
  const yearSuffix = year !== new Date().getFullYear() ? ` ${year}` : '';
  return opts?.short ? base + yearSuffix : `Sprint ${base}${yearSuffix}`;
}

/** Soma n sprints (n pode ser negativo). */
export function addSprints(s: string, n: number): string {
  const m = s.match(/^(\d{4})-(\d{2})-([12])$/);
  if (!m) return s;
  // Índice absoluto de quinzena: ano*24 + (mês-1)*2 + (metade-1)
  let idx = +m[1] * 24 + (+m[2] - 1) * 2 + (+m[3] - 1) + n;
  const year = Math.floor(idx / 24);
  idx -= year * 24;
  const month = Math.floor(idx / 2) + 1;
  const half = (idx % 2) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${half}`;
}

/** Opções para o seletor: das `back` sprints atrás até `forward` à frente. */
export function sprintOptions(back = 2, forward = 8): string[] {
  const cur = currentSprint();
  const out: string[] = [];
  for (let i = -back; i <= forward; i++) out.push(addSprints(cur, i));
  return out;
}
