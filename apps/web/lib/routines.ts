// IST day/week helpers for routines. IST is UTC+5:30 with no DST, so string math
// on en-CA (YYYY-MM-DD) dates is safe. Weeks run Monday–Sunday (spec SPEC-0007).

export function istToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

// 0=Sun … 6=Sat, matching JS getDay(), for the given YYYY-MM-DD day string.
export function dayOfWeek(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay(); // noon avoids any day-boundary drift
}

// Monday of the IST week containing `day`, as YYYY-MM-DD.
export function weekMonday(day: string): string {
  const d = new Date(`${day}T12:00:00Z`); // noon avoids any day-boundary drift
  const dow = d.getUTCDay(); // 0=Sun
  const back = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}
