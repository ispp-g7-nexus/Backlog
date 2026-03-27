import { useState, useEffect } from 'react';

const GH_OWNER = "ispp-g7-nexus", GH_REPO = "7-NexUS";
export const GH_STATS_KEY = "nexus_gh_stats_v5";

async function fetchGitHubStats(token) {
  const h = { "Authorization": `bearer ${token}`, "Content-Type": "application/json" };
  const B = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}`;

  async function gs(ep) {
    for (let i = 0; i < 4; i++) {
      const r = await fetch(`${B}/${ep}`, { headers: h });
      if (r.status === 202) { await new Promise(ok => setTimeout(ok, 3000)); continue; }
      if (r.ok) return r.json();
      return null;
    }
    return null;
  }

  // 1. Contributors - commit counts per login
  const crRaw = await fetch(`${B}/contributors?per_page=100`, { headers: h });
  if (!crRaw.ok) throw new Error(`HTTP ${crRaw.status}: ${crRaw.statusText}`);
  const crData = await crRaw.json();
  const commits = {};
  (Array.isArray(crData) ? crData : []).forEach(c => { commits[c.login.toLowerCase()] = c.contributions; });

  // 2–5. GitHub Insights stats endpoints (in parallel)
  const [statsContribs, commitActivity, punchCard, codeFreq] = await Promise.all([
    gs("stats/contributors"),
    gs("stats/commit_activity"),
    gs("stats/punch_card"),
    gs("stats/code_frequency"),
  ]);

  const lines = {}, consistency = {}, weeklyCommits = {}, linesWeekMap = {};
  if (Array.isArray(statsContribs)) {
    statsContribs.forEach(sc => {
      const l = sc.author?.login?.toLowerCase(); if (!l) return;
      lines[l] = {
        added:   sc.weeks.reduce((s, w) => s + w.a, 0),
        deleted: sc.weeks.reduce((s, w) => s + w.d, 0),
      };
      const aw = sc.weeks.filter(w => w.c > 0).length;
      consistency[l] = sc.weeks.length ? Math.round(aw / sc.weeks.length * 100) : 0;
      weeklyCommits[l] = sc.weeks.slice(-26).map(w => w.c);
      sc.weeks.forEach(w => {
        if (w.a > 0 || w.d !== 0) {
          if (!linesWeekMap[w.w]) linesWeekMap[w.w] = { a: 0, d: 0 };
          linesWeekMap[w.w].a += w.a || 0;
          linesWeekMap[w.w].d += Math.abs(w.d || 0);
        }
      });
    });
  }
  // Build linesActivity (52 weeks) from statsContribs weekly data
  const laNow = new Date(), laDow = laNow.getUTCDay();
  const laSun = new Date(laNow); laSun.setUTCDate(laNow.getUTCDate() - laDow); laSun.setUTCHours(0,0,0,0);
  const linesActivity = Array.from({length: 52}, (_, i) => {
    const wStart = new Date(laSun); wStart.setUTCDate(laSun.getUTCDate() - (51 - i) * 7);
    const ts = Math.floor(wStart.getTime() / 1000);
    const e = linesWeekMap[ts] || { a: 0, d: 0 };
    return { week: ts, added: e.a, deleted: e.d, total: e.a + e.d };
  });

  // 6. PRs + reviews via GraphQL (paginated, with dates & line counts)
  const prs = {}, reviews = {}, mergeTs = {}, prDayMap = {}, prPunchRaw = {}, prLoginDayMap = {};
  let cursor = null, hasMore = true;
  while (hasMore) {
    const af = cursor ? `, after:"${cursor}"` : "";
    const q = `{repository(owner:"${GH_OWNER}",name:"${GH_REPO}"){pullRequests(first:100${af}){nodes{author{login}state createdAt mergedAt additions deletions reviews(first:50){nodes{author{login}}}}pageInfo{hasNextPage endCursor}}}}`;
    const gr = await fetch("https://api.github.com/graphql", { method: "POST", headers: h, body: JSON.stringify({ query: q }) });
    if (!gr.ok) throw new Error(`GraphQL ${gr.status}`);
    const { data, errors } = await gr.json();
    if (errors?.length) throw new Error(errors[0].message);
    const pg = data?.repository?.pullRequests; if (!pg) break;
    pg.nodes.forEach(pr => {
      const a = pr.author?.login?.toLowerCase();
      if (a) {
        prs[a] = prs[a] || { total: 0, merged: 0, open: 0, additions: 0, deletions: 0 };
        prs[a].total++;
        if (pr.state === "MERGED") {
          prs[a].merged++;
          if (pr.mergedAt && pr.createdAt)
            (mergeTs[a] = mergeTs[a] || []).push((new Date(pr.mergedAt) - new Date(pr.createdAt)) / 86400000);
        } else if (pr.state === "OPEN") prs[a].open++;
        prs[a].additions += pr.additions || 0;
        prs[a].deletions += pr.deletions || 0;
        if (pr.createdAt) {
          const d = new Date(pr.createdAt);
          const dateStr = d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
          prDayMap[dateStr] = (prDayMap[dateStr] || 0) + 1;
          const pk = `${d.getUTCDay()}-${d.getUTCHours()}`;
          prPunchRaw[pk] = (prPunchRaw[pk] || 0) + 1;
          if (!prLoginDayMap[a]) prLoginDayMap[a] = {};
          prLoginDayMap[a][dateStr] = (prLoginDayMap[a][dateStr] || 0) + 1;
        }
      }
      pr.reviews?.nodes?.forEach(rv => {
        const r2 = rv.author?.login?.toLowerCase();
        if (r2 && r2 !== a) reviews[r2] = (reviews[r2] || 0) + 1;
      });
    });
    hasMore = pg.pageInfo.hasNextPage; cursor = pg.pageInfo.endCursor;
  }

  const avgMergeTime = {};
  Object.entries(mergeTs).forEach(([l, ts]) => {
    avgMergeTime[l] = Math.round(ts.reduce((s, d) => s + d, 0) / ts.length * 10) / 10;
  });

  // Build prActivity in same format as commitActivity: [{week, total, days:[sun..sat]}, ...]
  // Use Sunday-based weeks (same as GitHub stats/commit_activity)
  const prNow = new Date(), prDow = prNow.getUTCDay();
  const prSun = new Date(prNow); prSun.setUTCDate(prNow.getUTCDate() - prDow); prSun.setUTCHours(0,0,0,0);
  const prActivity = Array.from({length: 52}, (_, i) => {
    const wStart = new Date(prSun); wStart.setUTCDate(prSun.getUTCDate() - (51 - i) * 7);
    const days = Array.from({length: 7}, (_, d) => {
      const day = new Date(wStart); day.setUTCDate(wStart.getUTCDate() + d);
      return prDayMap[day.toISOString().slice(0, 10)] || 0;
    });
    return { week: Math.floor(wStart.getTime() / 1000), total: days.reduce((s, c) => s + c, 0), days };
  });
  const prPunch = [];
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) prPunch.push([d, h, prPunchRaw[`${d}-${h}`] || 0]);

  // Build weeklyPRs per login (last 26 weeks, same Sunday base as prActivity)
  // Note: TEAM_MEMBERS import is not available here; this will be calculated per-pane if needed
  const weeklyPRs = {};
  // Population of weeklyPRs deferred to component level to avoid circular dependency

  return {
    commits, lines, consistency, weeklyCommits,
    prs, reviews, avgMergeTime,
    commitActivity, punchCard, codeFreq,
    prActivity, prPunch, prLoginDayMap,
    linesActivity, weeklyPRs,
    fetchedAt: new Date().toISOString(),
  };
}

export function useGitHubStats() {
  const [stats, setStats] = useState(() => {
    try { const r = localStorage.getItem(GH_STATS_KEY); return r ? JSON.parse(r) : null; } catch (_) { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const token = localStorage.getItem("nexus_gh_token");
    if (!token) return;
    setLoading(true); setError("");
    try {
      const s = await fetchGitHubStats(token);
      setStats(s);
      localStorage.setItem(GH_STATS_KEY, JSON.stringify(s));
    } catch (ex) { setError(ex.message); }
    finally { setLoading(false); }
  }

  // Auto-refresh silencioso al montar si los datos tienen más de 2 minutos
  useEffect(() => {
    const token = localStorage.getItem("nexus_gh_token");
    if (!token) return;
    const age = stats?.fetchedAt ? Date.now() - new Date(stats.fetchedAt).getTime() : Infinity;
    if (age > 2 * 60 * 1000) refresh();
  }, []);

  return { stats, loading, error, refresh };
}
