const BASE_URL = localStorage.getItem('nexus_api_url') || '/api';

function getToken() {
  return localStorage.getItem('nexus_jwt');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('nexus_jwt');
    window.dispatchEvent(new Event('nexus:auth-expired'));
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) }),
  patch: (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

// Auth
export const authUrl = () => `${BASE_URL}/auth/github`;
export const fetchUser = () => api.get('/user');

// Projects
export const fetchProjects = () => api.get('/projects');
export const linkProject = (data) => api.post('/projects/link', data);
export const updateProject = (id, data) => api.patch(`/projects/${id}`, data);

// Members
export const fetchMembers = (pid) => api.get(`/projects/${pid}/members`);
export const importMembers = (pid) => api.post(`/projects/${pid}/members/import`);
export const addMember = (pid, data) => api.post(`/projects/${pid}/members`, data);
export const updateMember = (pid, mid, data) => api.patch(`/projects/${pid}/members/${mid}`, data);
export const deleteMember = (pid, mid) => api.delete(`/projects/${pid}/members/${mid}`);

// Teams
export const fetchTeams = (pid) => api.get(`/projects/${pid}/teams`);
export const createTeam = (pid, data) => api.post(`/projects/${pid}/teams`, data);
export const updateTeam = (pid, tid, data) => api.patch(`/projects/${pid}/teams/${tid}`, data);
export const deleteTeam = (pid, tid) => api.delete(`/projects/${pid}/teams/${tid}`);

// Sprints
export const fetchSprints = (pid) => api.get(`/projects/${pid}/sprints`);
export const createSprint = (pid, data) => api.post(`/projects/${pid}/sprints`, data);
export const updateSprint = (pid, sid, data) => api.patch(`/projects/${pid}/sprints/${sid}`, data);
export const deleteSprint = (pid, sid) => api.delete(`/projects/${pid}/sprints/${sid}`);

// Labels
export const fetchLabels = (pid) => api.get(`/projects/${pid}/labels`);
export const createLabel = (pid, data) => api.post(`/projects/${pid}/labels`, data);
export const updateLabel = (pid, lid, data) => api.patch(`/projects/${pid}/labels/${lid}`, data);
export const deleteLabel = (pid, lid) => api.delete(`/projects/${pid}/labels/${lid}`);

// Costs
export const fetchCosts = (pid) => api.get(`/projects/${pid}/costs`);
export const updateCosts = (pid, data) => api.put(`/projects/${pid}/costs`, data);

// Risks
export const fetchRisks = (pid) => api.get(`/projects/${pid}/risks`);
export const createRisk = (pid, data) => api.post(`/projects/${pid}/risks`, data);
export const updateRisk = (pid, rid, data) => api.patch(`/projects/${pid}/risks/${rid}`, data);
export const deleteRisk = (pid, rid) => api.delete(`/projects/${pid}/risks/${rid}`);

// Metrics
export const fetchMetrics = (pid) => api.get(`/projects/${pid}/metrics`);
export const updateMetrics = (pid, data) => api.put(`/projects/${pid}/metrics`, data);

// Views
export const fetchViews = (pid) => api.get(`/projects/${pid}/views`);
export const createView = (pid, data) => api.post(`/projects/${pid}/views`, data);
export const updateView = (pid, vid, data) => api.patch(`/projects/${pid}/views/${vid}`, data);
export const deleteView = (pid, vid) => api.delete(`/projects/${pid}/views/${vid}`);

// GitHub proxy
export const syncProject = (pid) => api.post(`/projects/${pid}/github/sync`);
export const updateField = (pid, data) => api.post(`/projects/${pid}/github/update-field`, data);
export const createIssue = (pid, data) => api.post(`/projects/${pid}/github/issues`, data);
export const fetchGitHubStats = (pid) => api.get(`/projects/${pid}/github/stats`);
export const fetchActivity = (pid) => api.get(`/projects/${pid}/github/activity`);

// Config
export const fetchConfig = (pid) => api.get(`/projects/${pid}/config`);
export const updateConfig = (pid, section, data) => api.patch(`/projects/${pid}/config/${section}`, data);

// Retro
export const fetchRetro = (pid, sprint) => api.get(`/projects/${pid}/retro/${sprint}`);
export const saveRetro = (pid, sprint, items) => api.put(`/projects/${pid}/retro/${sprint}`, { items });
