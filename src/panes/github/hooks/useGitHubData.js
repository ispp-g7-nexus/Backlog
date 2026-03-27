import { useMemo } from 'react';
import { TEAM_MEMBERS } from '../../../constants.js';

export const TC = { A: "#3b82f6", B: "#22c55e", C: "#f59e0b", D: "#a855f7" };

export function useGitHubData(stats) {
  return useMemo(() => {
    const memberStats = TEAM_MEMBERS.map(m => {
      const ll      = m.login.toLowerCase();
      const commits = stats?.commits?.[ll]     || 0;
      const pr      = stats?.prs?.[ll]         || { total: 0, merged: 0, open: 0, additions: 0, deletions: 0 };
      const revs    = stats?.reviews?.[ll]     || 0;
      const lns     = stats?.lines?.[ll]       || { added: 0, deleted: 0 };
      const cons    = stats?.consistency?.[ll] ?? null;
      const amt     = stats?.avgMergeTime?.[ll]?? null;
      const wc      = stats?.weeklyCommits?.[ll]|| [];
      const collabScore   = Math.min(Math.round(revs / (commits + 1) * 50), 100);
      const prEfficiency  = pr.total > 0 ? Math.round(pr.merged / pr.total * 100) : null;
      const codeImpact    = lns.added + lns.deleted;
      const codeChurn     = codeImpact > 0 ? Math.round(lns.deleted / codeImpact * 100) : null;
      const avgPRSize     = pr.merged > 0 ? Math.round((pr.additions + pr.deletions) / pr.merged) : null;
      return { m, commits, pr, revs, lns, cons, amt, wc, collabScore, prEfficiency, codeImpact, codeChurn, avgPRSize };
    });

    const totalCommits  = memberStats.reduce((s, ms) => s + ms.commits, 0);
    const totalPRs      = memberStats.reduce((s, ms) => s + ms.pr.merged, 0);
    const totalRevs     = memberStats.reduce((s, ms) => s + ms.revs, 0);
    const totalAdded    = memberStats.reduce((s, ms) => s + ms.lns.added, 0);
    const activeMembers = memberStats.filter(ms => ms.commits > 0 || ms.pr.total > 0 || ms.revs > 0).length;
    const hasData       = stats && (totalCommits > 0 || totalPRs > 0 || totalRevs > 0);

    const allMergeTimes = Object.values(stats?.avgMergeTime || {});
    const teamAvgMerge  = allMergeTimes.length
      ? Math.round(allMergeTimes.reduce((s, d) => s + d, 0) / allMergeTimes.length * 10) / 10
      : null;

    // Sorted arrays
    const byCommits  = [...memberStats].sort((a, b) => b.commits      - a.commits);
    const byPRs      = [...memberStats].sort((a, b) => b.pr.merged    - a.pr.merged);
    const byRevs     = [...memberStats].sort((a, b) => b.revs         - a.revs);
    const byLines    = [...memberStats].sort((a, b) => b.lns.added    - a.lns.added);
    const byDeleted  = [...memberStats].sort((a, b) => b.lns.deleted  - a.lns.deleted);
    const byCons     = [...memberStats].sort((a, b) => (b.cons ?? -1) - (a.cons ?? -1));
    const byCollab   = [...memberStats].sort((a, b) => b.collabScore  - a.collabScore);
    const byChurn    = [...memberStats].filter(ms => ms.codeChurn !== null && ms.lns.added > 0).sort((a, b) => a.codeChurn - b.codeChurn);
    const byPRSize   = [...memberStats].filter(ms => ms.avgPRSize !== null).sort((a, b) => b.avgPRSize - a.avgPRSize);
    const byMerge    = [...memberStats].filter(ms => ms.amt !== null).sort((a, b) => a.amt - b.amt);

    const maxCommits = Math.max(...memberStats.map(ms => ms.commits), 1);
    const maxPRs     = Math.max(...memberStats.map(ms => ms.pr.merged), 1);
    const maxRevs    = Math.max(...memberStats.map(ms => ms.revs), 1);
    const maxAdded   = Math.max(...memberStats.map(ms => ms.lns.added), 1);
    const maxDeleted = Math.max(...memberStats.map(ms => ms.lns.deleted), 1);
    const maxPRSize  = Math.max(...memberStats.filter(ms => ms.avgPRSize !== null).map(ms => ms.avgPRSize), 1);

    // Team totals
    const teamTotals = ["A", "B", "C", "D"].map(team => {
      const rows = memberStats.filter(ms => ms.m.team === team);
      return {
        team, color: TC[team],
        commits:  rows.reduce((s, ms) => s + ms.commits, 0),
        prs:      rows.reduce((s, ms) => s + ms.pr.merged, 0),
        reviews:  rows.reduce((s, ms) => s + ms.revs, 0),
        added:    rows.reduce((s, ms) => s + ms.lns.added, 0),
        members:  rows.length,
        active:   rows.filter(ms => ms.commits > 0 || ms.pr.total > 0 || ms.revs > 0).length,
      };
    });
    const maxTC  = Math.max(...teamTotals.map(t => t.commits), 1);
    const maxTPR = Math.max(...teamTotals.map(t => t.prs), 1);
    const maxTRV = Math.max(...teamTotals.map(t => t.reviews), 1);
    const maxTA  = Math.max(...teamTotals.map(t => t.added), 1);

    return {
      memberStats, totalCommits, totalPRs, totalRevs, totalAdded, activeMembers, hasData, teamAvgMerge, allMergeTimes,
      byCommits, byPRs, byRevs, byLines, byDeleted, byCons, byCollab, byChurn, byPRSize, byMerge,
      maxCommits, maxPRs, maxRevs, maxAdded, maxDeleted, maxPRSize,
      teamTotals, maxTC, maxTPR, maxTRV, maxTA,
    };
  }, [stats]);
}
