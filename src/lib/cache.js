// Cache management for localStorage
const CACHE_KEYS = {
  CLOCKIFY: 'nexus_clockify_v1',
  GH_STATS: 'nexus_gh_stats_v5',
  GH_TOKEN: 'nexus_gh_token',
  LIVE_DATA: 'nexus_live_data',
};

// Clockify report cache
export function saveClockify(report, fileName) {
  try {
    localStorage.setItem(CACHE_KEYS.CLOCKIFY, JSON.stringify({ r: report, f: fileName, t: Date.now() }));
  } catch (_) {}
}

export function loadClockify() {
  try {
    const raw = localStorage.getItem(CACHE_KEYS.CLOCKIFY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s?.r ? s : null;
  } catch (_) {
    return null;
  }
}

// GitHub stats cache
export function getGitHubStats() {
  try {
    const r = localStorage.getItem(CACHE_KEYS.GH_STATS);
    return r ? JSON.parse(r) : null;
  } catch (_) {
    return null;
  }
}

export function saveGitHubStats(stats) {
  try {
    localStorage.setItem(CACHE_KEYS.GH_STATS, JSON.stringify(stats));
  } catch (_) {}
}

// GitHub token
export function getGitHubToken() {
  try {
    return localStorage.getItem(CACHE_KEYS.GH_TOKEN) || '';
  } catch (_) {
    return '';
  }
}

export function saveGitHubToken(token) {
  try {
    if (token.trim()) localStorage.setItem(CACHE_KEYS.GH_TOKEN, token.trim());
    else localStorage.removeItem(CACHE_KEYS.GH_TOKEN);
  } catch (_) {}
}

// Live data
export function getLiveData() {
  try {
    const raw = localStorage.getItem(CACHE_KEYS.LIVE_DATA);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

export function saveLiveData(data) {
  try {
    localStorage.setItem(CACHE_KEYS.LIVE_DATA, JSON.stringify(data));
  } catch (_) {}
}

export function clearLiveData() {
  try {
    localStorage.removeItem(CACHE_KEYS.LIVE_DATA);
  } catch (_) {}
}
