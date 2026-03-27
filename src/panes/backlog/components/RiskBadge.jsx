const RISK_RULES = [
  { id: 'no-size', check: i => !i.size, label: 'Sin talla', color: '#f59e0b' },
  { id: 'no-dates', check: i => !i.startDate && !i.targetDate, label: 'Sin fechas', color: '#f59e0b' },
  { id: 'no-assignee', check: i => !(i.assignees?.length > 0), label: 'Sin asignar', color: '#fb923c' },
  { id: 'overdue', check: i => i.targetDate && i.status !== 'Done' && new Date(i.targetDate) < new Date(), label: 'Vencida', color: '#ef4444' },
  { id: 'stale', check: i => i.status === 'In progress' && i.startDate && (Date.now() - new Date(i.startDate).getTime()) > 7 * 86400000, label: '>7d', color: '#f87171' },
];

export function getRisks(item) {
  return RISK_RULES.filter(r => r.check(item));
}

export default function RiskBadge({ item }) {
  const risks = getRisks(item);
  if (risks.length === 0) return null;

  const worst = risks[0];
  return (
    <span className="risk-badge" title={risks.map(r => r.label).join(', ')}
      style={{ background: `${worst.color}20`, color: worst.color, borderColor: `${worst.color}40` }}>
      {risks.length > 1 ? `${risks.length} alertas` : worst.label}
    </span>
  );
}
