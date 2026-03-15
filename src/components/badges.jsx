import { MOSCOW_META, SIZE_META, STATUS_META } from '../constants.js';

export function MoscowBadge({ m }) {
  return (
    <span style={{
      background: MOSCOW_META[m].bg, color: MOSCOW_META[m].text,
      padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700, whiteSpace:"nowrap",
    }}>{m}</span>
  );
}
export function SizeBadge({ s }) {
  return (
    <span style={{
      background: SIZE_META[s].bg, color: SIZE_META[s].text,
      padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700,
      minWidth:26, display:"inline-block", textAlign:"center",
    }}>{s}</span>
  );
}
export function StatusBadge({ s }) {
  const meta = STATUS_META[s] || { bg:"var(--bdg-backlog-bg)", text:"var(--bdg-backlog-tx)" };
  return (
    <span style={{
      background:meta.bg, color:meta.text,
      padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700, whiteSpace:"nowrap",
    }}>{s || "Backlog"}</span>
  );
}
