import HighlightCards from '../components/HighlightCards.jsx';
import MemberCards from '../components/MemberCards.jsx';
import WeeklyChart, { prepareWeeklyData } from '../components/WeeklyChart.jsx';
import { TC } from '../hooks/useGitHubData.js';

export default function PRsEquipo({ data, stats }) {
  const { memberStats, teamTotals, totalPRs, maxTPR } = data;

  // --- Highlight cards ---
  const sorted = [...teamTotals].sort((a, b) => b.prs - a.prs);
  const topT = sorted[0], botT = sorted[sorted.length - 1];
  const highlightItems = [
    { label: '🥇 Más PRs', name: `Equipo ${topT?.team}`, val: `${topT?.prs}`, color: TC[topT?.team] },
    { label: '🔻 Menos PRs', name: `Equipo ${botT?.team}`, val: `${botT?.prs}`, color: '#f43f5e' },
    { label: '📊 Total PRs', name: null, val: `${totalPRs}`, color: 'var(--tx2)' },
  ];

  // --- Weekly PRs by team stacked ---
  let weeklyDisplay = null;
  if (Array.isArray(stats?.prActivity) && stats.prActivity.length > 0 && stats.weeklyPRs) {
    const actWeeks = stats.prActivity.slice(-26);
    weeklyDisplay = prepareWeeklyData(actWeeks, (w, i) => {
      const vals = { A: 0, B: 0, C: 0, D: 0 };
      memberStats.forEach(({ m }) => {
        const ll = m.login.toLowerCase();
        const wp = stats.weeklyPRs[ll];
        if (!wp) return;
        const wpIdx = i - (actWeeks.length - wp.length);
        if (wpIdx >= 0 && wpIdx < wp.length) vals[m.team] += wp[wpIdx] || 0;
      });
      return { vals, total: Object.values(vals).reduce((s, v) => s + v, 0) };
    });
  }

  return (
    <>
      <HighlightCards items={highlightItems} />

      {weeklyDisplay && (
        <WeeklyChart data={weeklyDisplay} teamColors={TC} title="📅 PRs por semana — por equipo" color="var(--tx2)" />
      )}

      {/* Team comparison */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--bdr)', borderRadius: 10, padding: '14px' }}>
        <div style={{ color: 'var(--tx2)', fontWeight: 700, fontSize: 9, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
          📊 Comparativa — PRs por equipo
        </div>
        {teamTotals.map(({ team, color, prs, members, active }) => {
          const teamEff = memberStats.filter(ms => ms.m.team === team && ms.prEfficiency !== null);
          const avgEff = teamEff.length ? Math.round(teamEff.reduce((s, ms) => s + (ms.prEfficiency ?? 0), 0) / teamEff.length) : null;
          return (
            <div key={team} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ background: `${color}20`, color, fontWeight: 800, fontSize: 9, textTransform: 'uppercase', letterSpacing: 2, padding: '2px 8px', borderRadius: 4 }}>
                  Equipo {team}
                </span>
                <span style={{ color: 'var(--tx4)', fontSize: 8.5 }}>
                  {active}/{members} activos{avgEff !== null ? ` · ${avgEff}% merge rate` : ''}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: 'var(--tx4)', fontSize: 7.5, width: 38, flexShrink: 0 }}>PRs</span>
                <div style={{ flex: 1, height: 5, background: 'var(--bdr)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ height: '100%', width: `${maxTPR > 0 ? prs / maxTPR * 100 : 0}%`, background: '#34d399', borderRadius: 3, opacity: 0.9 }} />
                  {maxTPR > 0 && (
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${totalPRs / 4 / maxTPR * 100}%`, width: 1, background: 'var(--tx2)', opacity: 0.5 }} />
                  )}
                </div>
                <span style={{ color: '#34d399', fontSize: 8.5, fontWeight: 700, width: 30, textAlign: 'right', flexShrink: 0 }}>{prs}</span>
              </div>
            </div>
          );
        })}
      </div>

      <MemberCards
        memberStats={memberStats}
        teamTotals={teamTotals}
        ghTab="prs"
        maxCommits={data.maxCommits}
        maxPRs={data.maxPRs}
        maxRevs={data.maxRevs}
        maxAdded={data.maxAdded}
        totalCommits={data.totalCommits}
      />
    </>
  );
}
