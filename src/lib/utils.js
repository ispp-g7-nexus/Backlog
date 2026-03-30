import { SC } from '../constants.js';
import { SPRINTS } from '../data.js';

// Normalize DD/MM/YYYY → YYYY-MM-DD so sort() works correctly
export function normDate(d) {
  if (d && /^\d{2}\/\d{2}\/\d{4}$/.test(d))
    return `${d.slice(6)}-${d.slice(3,5)}-${d.slice(0,2)}`;
  return d;
}

export function detectCurrentSprint() {
  const now = Date.now();
  for (const { sprint: s } of SPRINTS) {
    const c = SC[s];
    if (c && new Date(c.start).getTime() <= now && now <= new Date(c.end).getTime() + 86400000) return s;
  }
  return SPRINTS[SPRINTS.length - 1]?.sprint || 1;
}
