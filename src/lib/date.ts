/** Today (or a given date) as YYYY-MM-DD in the LOCAL timezone.
 *
 *  `toISOString()` converts to UTC first, so in Brazil (UTC-3) anything after
 *  21:00 already reports the next day: tasks created in the evening were stamped
 *  with tomorrow's date, and every task due today was compared against tomorrow
 *  and shown as overdue. */
export function localISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
