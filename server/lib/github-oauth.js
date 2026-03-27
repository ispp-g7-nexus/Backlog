const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API = 'https://api.github.com';

export function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: process.env.GITHUB_CALLBACK_URL || `${process.env.BASE_URL || 'http://localhost:4000'}/auth/callback`,
    scope: 'repo read:org project',
    state,
  });
  return `${GITHUB_AUTH_URL}?${params}`;
}

export async function exchangeCode(code) {
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data.access_token;
}

export async function fetchGitHubUser(token) {
  const res = await fetch(`${GITHUB_API}/user`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

export async function fetchUserRepos(token) {
  const repos = [];
  let page = 1;
  while (page <= 5) {
    const res = await fetch(`${GITHUB_API}/user/repos?per_page=100&page=${page}&sort=updated`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const data = await res.json();
    if (!data.length) break;
    repos.push(...data.map(r => ({
      id: r.id, full_name: r.full_name, name: r.name,
      owner: r.owner.login, private: r.private,
      permissions: r.permissions, html_url: r.html_url,
    })));
    page++;
  }
  return repos;
}

export async function fetchUserOrgs(token) {
  const res = await fetch(`${GITHUB_API}/user/orgs`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  return res.json();
}

export async function fetchOrgRepos(token, org) {
  const repos = [];
  let page = 1;
  while (page <= 5) {
    const res = await fetch(`${GITHUB_API}/orgs/${org}/repos?per_page=100&page=${page}&sort=updated`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const data = await res.json();
    if (!data.length) break;
    repos.push(...data.map(r => ({
      id: r.id, full_name: r.full_name, name: r.name,
      owner: r.owner.login, private: r.private,
      permissions: r.permissions, html_url: r.html_url,
    })));
    page++;
  }
  return repos;
}
