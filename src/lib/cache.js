// Centralized localStorage key registry and helpers
export const CACHE_KEYS = {
  // Auth / backend
  JWT:        'nexus_jwt',
  API_URL:    'nexus_api_url',
  PROJECT_ID: 'nexus_project_id',
  SETTINGS:   'nexus_settings_v1',
  // GitHub PAT / data
  GH_TOKEN:   'nexus_gh_token',
  GH_STATS:   'nexus_gh_stats_v5',
  SCHEMA:     'nexus_project_schema_v1',
  LIVE_DATA:  'nexus_live_data',
  // Backlog mutations
  EDITS:      'nexus_edits_v1',
  DELETED:    'nexus_deleted_v1',
  CREATED:    'nexus_created_v1',
  // App-specific
  CLOCKIFY:   'nexus_clockify_v1',
  RETRO:      'nexus_retro_v1',
  MY_LOGIN:   'nexus_my_login',
};

// Generic helpers
export function getJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export function setJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function remove(key) {
  try { localStorage.removeItem(key); } catch {}
}

// --- Clockify report cache ---
export function saveClockify(report, fileName) {
  setJson(CACHE_KEYS.CLOCKIFY, { r: report, f: fileName, t: Date.now() });
}

export function loadClockify() {
  const s = getJson(CACHE_KEYS.CLOCKIFY);
  return s?.r ? s : null;
}

// --- GitHub stats cache ---
export function getGitHubStats() {
  return getJson(CACHE_KEYS.GH_STATS);
}

export function saveGitHubStats(stats) {
  setJson(CACHE_KEYS.GH_STATS, stats);
}

// --- GitHub token ---
export function getGitHubToken() {
  try { return localStorage.getItem(CACHE_KEYS.GH_TOKEN) || ''; } catch { return ''; }
}

export function saveGitHubToken(token) {
  try {
    if (token.trim()) localStorage.setItem(CACHE_KEYS.GH_TOKEN, token.trim());
    else localStorage.removeItem(CACHE_KEYS.GH_TOKEN);
  } catch {}
}

// --- Live data ---
export function getLiveData() {
  return getJson(CACHE_KEYS.LIVE_DATA);
}

export function saveLiveData(data) {
  setJson(CACHE_KEYS.LIVE_DATA, data);
}

export function clearLiveData() {
  remove(CACHE_KEYS.LIVE_DATA);
}
