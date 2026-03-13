import rawData from '../data/nexus-backlog.json';
import { getLiveData } from './lib/cache.js';

export { rawData };

// ── MAP GITHUB PROJECT DATA ────────────────────────────────────
function mapGithubItem(raw) {
  const idMatch = raw.title.match(/^\[([^\]]+)\]/);
  const id    = idMatch ? idMatch[1] : `#${raw.number}`;
  const title = raw.title.replace(/^\[[^\]]+\]\s*/, '').trim();
  const sprintMatch = raw.milestone && raw.milestone.match(/\d+/);
  const sprint = sprintMatch ? parseInt(sprintMatch[0], 10) : null;
  const area   = raw.labels && raw.labels.length > 0 ? raw.labels[0].name : 'Sin área';
  return {
    id, sprint, area, title,
    size:      raw.size      || null,
    status:    raw.status    || 'Backlog',
    equipo:    raw.equipo    || null,
    assignees: raw.assignees || [],
    url:       raw.url       || null,
    state:     raw.state     || 'OPEN',
  };
}

// ── LIVE DATA (localStorage override) ────────────────────────
const _storedLive = getLiveData();
const _sourceData = (_storedLive && _storedLive.fetchedAt > rawData.fetchedAt) ? _storedLive : rawData;

// ── BUILD BACKLOG ────────────────────────────────────────────
export const BACKLOG = _sourceData.items
  .map(mapGithubItem)
  .filter(i => i.sprint && !isNaN(i.sprint))
  .sort((a, b) => {
    if (a.sprint !== b.sprint) return a.sprint - b.sprint;
    const na = parseInt(a.id.match(/\.(\d+)$/)?.[1] ?? '0', 10);
    const nb = parseInt(b.id.match(/\.(\d+)$/)?.[1] ?? '0', 10);
    return na - nb;
  });

// ── BUILD BACKLOG MAP (ID→Item) ────────────────────────────────
export const BACKLOG_MAP = Object.fromEntries(BACKLOG.map(item => [item.id, item]));

