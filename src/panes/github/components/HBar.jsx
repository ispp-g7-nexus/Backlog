import { TC } from '../hooks/useGitHubData.js';

export default function HBar({ sorted, getValue, getLabel, maxVal, color, showMax, avgVal }) {
  const mv     = showMax ? maxVal : Math.max(...sorted.map(ms => getValue(ms)), 1);
  const avgPct = avgVal !== undefined && mv > 0 ? avgVal / mv * 100 : null;
  return sorted.map(ms => {
    const v = getValue(ms);
    return (
      <div key={ms.m.login} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
        <img src={`https://github.com/${ms.m.login}.png?size=20`} alt={ms.m.name}
          style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, border: `1px solid ${TC[ms.m.team]}50` }} />
        <span style={{ color: "var(--tx2)", fontSize: 8.5, width: 46, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>
          {ms.m.name.split(" ")[0]}
        </span>
        <div style={{ flex: 1, height: 6, background: "var(--bdr)", borderRadius: 3, overflow: "hidden", position: "relative" }}>
          <div style={{ height: "100%", width: `${mv > 0 ? v / mv * 100 : 0}%`, background: TC[ms.m.team], borderRadius: 3 }} />
          {avgPct !== null && <div style={{ position:"absolute", top:0, bottom:0, left:`${avgPct}%`, width:1, background:"var(--tx2)", opacity:0.6 }}/>}
        </div>
        <span style={{ color, fontSize: 8.5, fontWeight: 700, width: 28, textAlign: "right", flexShrink: 0 }}>
          {getLabel ? getLabel(ms) : v}
        </span>
      </div>
    );
  });
}
