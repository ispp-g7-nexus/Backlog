import { useMemo } from 'react';
import { TEAM_MEMBERS } from '../../../constants.js';
import { SC } from '../../../constants.js';
import { TC } from '../hooks/useGitHubData.js';

const TYPE_PREFIXES = [
  { prefix: "feat",     label: "feat",     color: "#818cf8" },
  { prefix: "feature",  label: "feature",  color: "#818cf8" },
  { prefix: "fix",      label: "fix",      color: "#f87171" },
  { prefix: "bugfix",   label: "bugfix",   color: "#f87171" },
  { prefix: "hotfix",   label: "hotfix",   color: "#fb923c" },
  { prefix: "docs",     label: "docs",     color: "#38bdf8" },
  { prefix: "chore",    label: "chore",    color: "#94a3b8" },
  { prefix: "refactor", label: "refactor", color: "#a78bfa" },
  { prefix: "test",     label: "test",     color: "#4ade80" },
  { prefix: "style",    label: "style",    color: "#f472b6" },
];

function getPrefix(name) {
  const lc = name.toLowerCase();
  for (const t of TYPE_PREFIXES) {
    if (lc.startsWith(t.prefix + "/") || lc.startsWith(t.prefix + "-")) return t;
  }
  return { prefix: "other", label: "other", color: "#64748b" };
}

function teamColor(login) {
  if (!login) return "#52525b";
  const m = TEAM_MEMBERS.find(m => m.login.toLowerCase() === login.toLowerCase());
  return m ? (TC[m.team] || "#52525b") : "#52525b";
}

function relativeDate(iso) {
  if (!iso) return "—";
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days}d`;
  const months = Math.round(days / 30);
  return `hace ${months}m`;
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: "var(--bg2)", border: `1px solid ${color}30`, borderRadius: 10, padding: "12px 16px", flex: "1 1 110px", minWidth: 100 }}>
      <div style={{ color: "var(--tx4)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ color, fontSize: 22, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

export default function RamasView({ stats }) {
  const branches = stats?.branchList || [];

  const { open, merged, noPR } = useMemo(() => ({
    open:   branches.filter(b => b.pr?.state === "OPEN").length,
    merged: branches.filter(b => b.pr?.state === "MERGED").length,
    noPR:   branches.filter(b => !b.pr).length,
  }), [branches]);

  // Distribución por tipo
  const byType = useMemo(() => {
    const counts = {};
    for (const b of branches) {
      const t = getPrefix(b.name);
      counts[t.label] = (counts[t.label] || { label: t.label, color: t.color, count: 0 });
      counts[t.label].count++;
    }
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [branches]);
  const maxType = Math.max(...byType.map(t => t.count), 1);

  // Gantt SVG
  const W = 480, padL = 88, padR = 10, padT = 20, padB = 14, ROW_H = 14;
  const ganttBranches = branches.slice(0, 25);
  const ganttH = padT + ganttBranches.length * ROW_H + padB + 8;

  const xStart = new Date(SC[1].start).getTime();
  const xEnd = Math.max(new Date(SC[3].end).getTime(), Date.now());
  const xRange = xEnd - xStart;
  const toX = ts => padL + ((ts - xStart) / xRange) * (W - padL - padR);
  const nowX = toX(Date.now());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <StatCard label="Total ramas" value={branches.length} color="#4ade80" />
        <StatCard label="Abiertas" value={open} color="#22d3ee" />
        <StatCard label="Mergeadas" value={merged} color="#a78bfa" />
        <StatCard label="Sin PR" value={noPR} color="#94a3b8" />
      </div>

      {/* Distribución por tipo */}
      {byType.length > 0 && (
        <div style={{ background: "var(--bg2)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ color: "var(--tx3)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Distribución por tipo</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {byType.map(t => (
              <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ color: t.color, fontSize: 10, fontWeight: 700, width: 60, textAlign: "right", flexShrink: 0 }}>{t.label}</div>
                <div style={{ flex: 1, background: "var(--bg3)", borderRadius: 3, height: 8 }}>
                  <div style={{ width: `${(t.count / maxType) * 100}%`, background: t.color, height: 8, borderRadius: 3, transition: "width .3s" }} />
                </div>
                <div style={{ color: "var(--tx3)", fontSize: 10, width: 20, textAlign: "right" }}>{t.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gantt SVG */}
      {ganttBranches.length > 0 && (
        <div style={{ background: "var(--bg2)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "14px 16px", overflowX: "auto" }}>
          <div style={{ color: "var(--tx3)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Timeline de ramas (últimas {ganttBranches.length})</div>
          <svg width={W} height={ganttH} style={{ display: "block", maxWidth: "100%" }}>
            {/* Sprint dividers */}
            {Object.values(SC).map(s => {
              const x = toX(new Date(s.start).getTime());
              if (x < padL || x > W - padR) return null;
              return (
                <g key={s.label}>
                  <line x1={x} y1={padT - 6} x2={x} y2={ganttH - padB} stroke={s.color} strokeWidth={1} strokeDasharray="3,3" opacity={0.5} />
                  <text x={x + 2} y={padT - 8} fill={s.color} fontSize={7} fontWeight={600}>{s.label}</text>
                </g>
              );
            })}
            {/* Main branch line */}
            <line x1={padL} y1={padT - 2} x2={W - padR} y2={padT - 2} stroke="#4ade80" strokeWidth={2.5} />
            <text x={padL - 4} y={padT + 2} fill="#4ade80" fontSize={8} fontWeight={700} textAnchor="end">main</text>
            {/* Today line */}
            {nowX >= padL && nowX <= W - padR && (
              <line x1={nowX} y1={padT - 6} x2={nowX} y2={ganttH - padB} stroke="#f59e0b" strokeWidth={1} strokeDasharray="2,2" opacity={0.7} />
            )}
            {/* Branches */}
            {ganttBranches.map((b, i) => {
              const y = padT + 8 + i * ROW_H;
              const login = b.pr?.authorLogin || b.authorLogin;
              const color = teamColor(login);
              const startTs = new Date(b.pr?.createdAt || b.lastCommit || SC[1].start).getTime();
              const endTs = b.pr?.mergedAt
                ? new Date(b.pr.mergedAt).getTime()
                : b.pr?.state === "OPEN"
                  ? Date.now()
                  : new Date(b.lastCommit || Date.now()).getTime();
              const x1 = Math.max(toX(startTs), padL);
              const x2 = Math.min(toX(endTs), W - padR);
              const barW = Math.max(x2 - x1, 4);
              const truncName = b.name.length > 18 ? b.name.slice(0, 17) + "…" : b.name;
              const prState = b.pr?.state;
              return (
                <g key={b.name}>
                  <title>{b.name} · {prState || "sin PR"} · {login || "?"} · {relativeDate(b.lastCommit)}</title>
                  <text x={padL - 4} y={y + 4} fill={color} fontSize={7} textAnchor="end">{truncName}</text>
                  <rect x={x1} y={y - 1} width={barW} height={5} rx={2} fill={color} opacity={0.75} />
                  {/* End marker */}
                  {prState === "MERGED"
                    ? <circle cx={x2} cy={y + 1.5} r={3} fill={color} />
                    : prState === "OPEN"
                      ? <circle cx={x2} cy={y + 1.5} r={3} fill="transparent" stroke={color} strokeWidth={1.5} />
                      : <rect x={x2 - 2} y={y - 1} width={4} height={5} fill={color} opacity={0.5} />
                  }
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* Branch list */}
      {branches.length === 0 ? (
        <div style={{ color: "var(--tx4)", fontSize: 12, textAlign: "center", padding: 24 }}>
          Sin datos de ramas. Pulsa «Actualizar métricas» con un token válido.
        </div>
      ) : (
        <div style={{ background: "var(--bg2)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ color: "var(--tx3)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            Todas las ramas ({branches.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 400, overflowY: "auto" }}>
            {branches.map(b => {
              const pt = getPrefix(b.name);
              const login = b.pr?.authorLogin || b.authorLogin;
              const member = login ? TEAM_MEMBERS.find(m => m.login.toLowerCase() === login) : null;
              const prState = b.pr?.state;
              const stateLabel = prState === "OPEN" ? "Abierta" : prState === "MERGED" ? "Mergeada" : prState === "CLOSED" ? "Cerrada" : "Sin PR";
              const stateColor = prState === "OPEN" ? "#22d3ee" : prState === "MERGED" ? "#a78bfa" : prState === "CLOSED" ? "#f87171" : "#64748b";
              return (
                <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: "var(--bg3)", borderRadius: 7, flexWrap: "wrap" }}>
                  {/* Branch name */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "1 1 180px", minWidth: 0 }}>
                    <span style={{ color: pt.color, fontSize: 9, fontWeight: 700, background: `${pt.color}18`, borderRadius: 3, padding: "1px 4px", flexShrink: 0 }}>{pt.label}</span>
                    <span style={{ color: "var(--tx2)", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
                  </div>
                  {/* State badge */}
                  <span style={{ color: stateColor, background: `${stateColor}15`, borderRadius: 4, padding: "1px 7px", fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{stateLabel}</span>
                  {/* Author */}
                  {member && (
                    <span style={{ color: TC[member.team] || "#94a3b8", background: `${TC[member.team] || "#94a3b8"}15`, borderRadius: 4, padding: "1px 7px", fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                      {member.name.split(" ")[0]} · {member.team}
                    </span>
                  )}
                  {/* Last commit date */}
                  <span style={{ color: "var(--tx4)", fontSize: 9, flexShrink: 0 }}>{relativeDate(b.lastCommit)}</span>
                  {/* Line delta */}
                  {b.pr && (b.pr.additions > 0 || b.pr.deletions > 0) && (
                    <span style={{ fontSize: 8, flexShrink: 0 }}>
                      <span style={{ color: "#4ade80" }}>+{b.pr.additions}</span>
                      <span style={{ color: "#94a3b8" }}> / </span>
                      <span style={{ color: "#f87171" }}>-{b.pr.deletions}</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
