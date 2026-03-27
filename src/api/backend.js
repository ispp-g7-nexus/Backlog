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
  patch: (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

// Auth
export const authUrl = () => `${BASE_URL}/auth/github`;
export const fetchUser = () => api.get('/user');

// Projects
export const fetchProjects = () => api.get('/projects');
export const createProject = (data) => api.post('/projects', data);
export const updateProject = (id, data) => api.patch(`/projects/${id}`, data);
export const deleteProject = (id) => api.delete(`/projects/${id}`);

// Members
export const fetchMembers = (pid) => api.get(`/projects/${pid}/members`);
export const importMembers = (pid) => api.post(`/projects/${pid}/members/import`);
export const updateMember = (pid, mid, data) => api.patch(`/projects/${pid}/members/${mid}`, data);

// Teams
export const fetchTeams = (pid) => api.get(`/projects/${pid}/teams`);
export const createTeam = (pid, data) => api.post(`/projects/${pid}/teams`, data);

// Sprints
export const fetchSprints = (pid) => api.get(`/projects/${pid}/sprints`);
export const createSprint = (pid, data) => api.post(`/projects/${pid}/sprints`, data);

// GitHub proxy
export const syncProject = (pid) => api.post(`/projects/${pid}/github/sync`);
export const updateField = (pid, data) => api.post(`/projects/${pid}/github/update-field`, data);
export const createIssue = (pid, data) => api.post(`/projects/${pid}/github/issues`, data);
export const fetchGitHubStats = (pid) => api.get(`/projects/${pid}/github/stats`);
export const fetchActivity = (pid) => api.get(`/projects/${pid}/github/activity`);

// Config
export const fetchConfig = (pid) => api.get(`/projects/${pid}/config`);
export const updateConfig = (pid, section, data) => api.patch(`/projects/${pid}/config/${section}`, data);
