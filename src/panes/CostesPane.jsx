import { StatCard } from '../components/StatCard.jsx';
import { BACKLOG } from '../data.js';
import { SIZE_H_MAP } from '../constants.js';
import { calcPEM, calcBudget, HBS_RATE, PRESUPUESTO_TOTAL, GG_PCT, BI_PCT, IVA_PCT } from '../lib/costes.js';
import { loadClockify } from '../lib/cache.js';

// Horas S0 fijas
const S0_HOURS = 757;

function getClockifyHours() {
  const cached = loadClockify();
  const report = cached?.r || null;
  if (!report) return { s0: 0, s1: 0, s2: 0, s3: 0, total: 0 };
  const byEmail = report.byEmail || {};
  const sum = (key) => Object.values(byEmail).reduce((s, e) => s + (e[key] || 0), 0);
  const s0 = sum('dp_h');
  const s1 = sum('s1_h');
  const s2 = sum('s2_h');
  const s3 = sum('s3_h');
  return { s0, s1, s2, s3, total: s0 + s1 + s2 + s3 };
}
const PPT_PERFILES = [
  { perfil:"Jefe de Proyecto", rolLabel:"Product Owner",  mult:2.20, precioH:56.10, color:"#fbbf24", count: 1 },
  { perfil:"Consultor",        rolLabel:"Scrum Master",   mult:1.70, precioH:43.35, color:"#34d399", count: 1 },
  { perfil:"Coordinador",      rolLabel:"Coordinador",    mult:1.42, precioH:36.21, color:"#818cf8", count: 6 },
  { perfil:"Programador",      rolLabel:"Desarrollador",  mult:1.12, precioH:28.56, color:"#a78bfa", count: 13 },
];

export default function CostesPane() {
  const eur = (n) => n.toLocaleString("es-ES", { minimumFractionDigits:2, maximumFractionDigits:2 });

  // Horas reales de Clockify
  const clockH = getClockifyHours();
  const hasClockify = clockH.total > 0;

  // Calcular horas estimadas por sprint (backlog)
  const sprintH = {1:0, 2:0, 3:0};
  BACKLOG.forEach(it => { sprintH[it.sprint] = (sprintH[it.sprint]||0) + (SIZE_H_MAP[it.size]||0); });

  // Horas reales: usar Clockify si disponible, si no usar S0_HOURS/estimados
  const s0RealH = hasClockify && clockH.s0 > 0 ? clockH.s0 : S0_HOURS;
  const s1RealH = hasClockify && clockH.s1 > 0 ? clockH.s1 : 0;
  const s2RealH = hasClockify && clockH.s2 > 0 ? clockH.s2 : 0;
  const s3RealH = hasClockify && clockH.s3 > 0 ? clockH.s3 : 0;

  // Presupuestos por fase
  const s0bud  = calcBudget(calcPEM(S0_HOURS));
  const s1bud  = calcBudget(calcPEM(sprintH[1]));
  const s1real = s1RealH > 0 ? calcBudget(calcPEM(s1RealH)) : null;
  const s2bud  = calcBudget(calcPEM(sprintH[2]));
  const s2real = s2RealH > 0 ? calcBudget(calcPEM(s2RealH)) : null;
  const s3bud  = calcBudget(calcPEM(sprintH[3]));
  const s3real = s3RealH > 0 ? calcBudget(calcPEM(s3RealH)) : null;
  const totbud = calcBudget(calcPEM((S0_HOURS + sprintH[1] + sprintH[2] + sprintH[3])));

  // Gasto acumulado real: horas reales disponibles
  const realAccumH = s0RealH + s1RealH + s2RealH + s3RealH;
  const realAccumBud = calcBudget(calcPEM(realAccumH));
  const gastadoAcum = realAccumBud.total;
  const remanente   = PRESUPUESTO_TOTAL - gastadoAcum;
  const ejecucion   = (gastadoAcum / PRESUPUESTO_TOTAL) * 100;

  // Fila de desglose presupuestario
  function BudgetRow({ label, value, color, bold, border }) {
    return (
      <div style={{ display:"flex", justifyContent:"space-between", padding:"6px 0",
        borderTop: border ? "1px solid var(--bdr2)" : "none" }}>
        <span style={{ color: color || "var(--tx3)", fontSize:12, fontWeight: bold ? 700 : 400 }}>{label}</span>
        <span style={{ color: color || "var(--tx0)", fontSize:12, fontWeight: bold ? 700 : 600, fontVariantNumeric:"tabular-nums" }}>
          {value}
        </span>
      </div>
    );
  }

  // Tarjeta de fase con desglose
  function PhaseCard({ label, color, hours, bud, realH, realBud, isEstim }) {
    return (
      <div style={{ background:`${color}08`, border:`1px solid ${color}30`, borderRadius:10, padding:"14px 18px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <span style={{ color, fontWeight:700, fontSize:13 }}>{label}</span>
          <span style={{ background:`${color}20`, color, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:4 }}>
            {isEstim ? "Estimado backlog" : "Real Clockify"}
          </span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:10, fontSize:11 }}>
          <div>
            <div style={{ color:"var(--tx4)", fontSize:10 }}>HORAS</div>
            <div style={{ color:"var(--tx0)", fontWeight:800, fontSize:16 }}>{hours}h</div>
            <div style={{ color:"var(--tx3)" }}>{(hours/21).toFixed(1)}h/persona</div>
          </div>
          <div>
            <div style={{ color:"var(--tx4)", fontSize:10 }}>TOTAL (IVA inc.)</div>
            <div style={{ color, fontWeight:800, fontSize:16 }}>{eur(bud.total)} €</div>
            <div style={{ color:"var(--tx3)" }}>PEM: {eur(bud.pem)} €</div>
          </div>
        </div>
        <div style={{ background:"var(--bg0)", borderRadius:7, padding:"8px 12px", fontSize:11 }}>
          <BudgetRow label="PEM (mano de obra)"          value={`${eur(bud.pem)} €`}   />
          <BudgetRow label={`Gastos Generales (${(GG_PCT*100).toFixed(0)}%)`}  value={`${eur(bud.gg)} €`}    />
          <BudgetRow label={`Beneficio Industrial (${(BI_PCT*100).toFixed(0)}%)`} value={`${eur(bud.bi)} €`} />
          <BudgetRow label="Base Imponible"               value={`${eur(bud.base)} €`} border />
          <BudgetRow label={`IVA (${(IVA_PCT*100).toFixed(0)}%)`} value={`${eur(bud.iva)} €`} />
          <BudgetRow label="TOTAL FASE"                   value={`${eur(bud.total)} €`} color={color} bold border />
        </div>
        {realBud && (
          <div style={{ marginTop:8, background:"#34d39910", border:"1px solid #34d39930", borderRadius:7, padding:"8px 12px", fontSize:11 }}>
            <div style={{ color:"#34d399", fontWeight:700, marginBottom:4 }}>Real Clockify: {realH}h registradas</div>
            <BudgetRow label="PEM real" value={`${eur(realBud.pem)} €`} color="#34d399" />
            <BudgetRow label="TOTAL REAL (IVA inc.)" value={`${eur(realBud.total)} €`} color="#34d399" bold border />
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

      {/* Scope notice */}
      <div style={{ fontSize: 10, color: 'var(--tx4)', background: 'var(--bg0)', border: '1px solid var(--bdr)', borderRadius: 6, padding: '5px 12px' }}>
        ℹ Desglose económico de todas las fases del proyecto (S0–S3). No filtrable por sprint individual.
      </div>

      {/* Header */}
      <div style={{ background:"var(--bg2)", border:"1px solid #f9731630", borderRadius:12, padding:"14px 20px" }}>
        <div style={{ color:"#f97316", fontWeight:700, fontSize:14, marginBottom:2 }}>💰 Seguimiento económico — PPT Junta de Andalucía</div>
        <div style={{ color:"var(--tx3)", fontSize:11 }}>
          HBS {eur(HBS_RATE)}€/h · GG {(GG_PCT*100).toFixed(0)}% · BI {(BI_PCT*100).toFixed(0)}% · IVA {(IVA_PCT*100).toFixed(0)}% · Presupuesto adjudicado 150.000,00 €
        </div>
        {hasClockify
          ? <div style={{ color:"#34d399", fontSize:10, marginTop:4 }}>✓ Datos Clockify cargados · {clockH.total.toFixed(1)}h totales (S0:{clockH.s0.toFixed(0)}h S1:{clockH.s1.toFixed(0)}h S2:{clockH.s2.toFixed(0)}h S3:{clockH.s3.toFixed(0)}h)</div>
          : <div style={{ color:"#f59e0b", fontSize:10, marginTop:4 }}>⚠ Sin datos Clockify — los gastos se calculan con horas estimadas. Carga un CSV en «Horas».</div>
        }
      </div>

      {/* KPI Globales */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        <StatCard label="Presupuesto adjudicado"  value="150.000 €"              sub="IVA incluido"                                         color="#f97316" />
        <StatCard label="Gasto acumulado (S0+S1)" value={`${eur(gastadoAcum)} €`} sub={`${ejecucion.toFixed(2)}% ejecutado`}               color="#f43f5e" />
        <StatCard label="Remanente"               value={`${eur(remanente)} €`}  sub={`${(100-ejecucion).toFixed(2)}% disponible`}          color="#34d399" />
        <StatCard label="PEM total estimado"      value={`${eur(totbud.pem)} €`} sub={`${(S0_HOURS + sprintH[1] + sprintH[2] + sprintH[3])}h · ${eur(totbud.total)}€ c/IVA`} color="#818cf8" />
      </div>

      {/* Tabla de tarifas PPT */}
      <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, padding:"18px 22px" }}>
        <div style={{ color:"var(--tx0)", fontWeight:700, fontSize:13, marginBottom:14 }}>
          📋 Desglose de Costes de Personal (HBS — Hora Básica de Servicio)
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ borderBottom:"1px solid var(--bdr)" }}>
                {["Perfil Profesional (PPT)","Rol Asignado","Multiplicador","Precio/Hora","Personas","Horas S1 (20h/p)","Total Sprint 1"].map(h => (
                  <th key={h} style={{ padding:"7px 12px", color:"var(--tx3)", fontWeight:600, textAlign: h.startsWith("Total") || h.startsWith("Horas") || h === "Personas" || h === "Multiplicador" || h === "Precio/Hora" ? "right" : "left", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PPT_PERFILES.map(p => {
                const hS1   = 20;
                const total = p.count * hS1 * p.precioH;
                return (
                  <tr key={p.perfil} style={{ borderBottom:"1px solid #1c1c1e" }}>
                    <td style={{ padding:"8px 12px" }}><span style={{ color:p.color, fontWeight:700 }}>{p.perfil}</span></td>
                    <td style={{ padding:"8px 12px", color:"#a1a1aa" }}>{p.rolLabel}</td>
                    <td style={{ padding:"8px 12px", color:"var(--tx0)", fontWeight:600, textAlign:"right" }}>×{p.mult.toFixed(2)}</td>
                    <td style={{ padding:"8px 12px", color:p.color, fontWeight:700, textAlign:"right" }}>{eur(p.precioH)} €</td>
                    <td style={{ padding:"8px 12px", color:"var(--tx0)", fontWeight:800, textAlign:"right" }}>{p.count}</td>
                    <td style={{ padding:"8px 12px", color:"var(--tx3)", textAlign:"right" }}>{p.count * hS1}h</td>
                    <td style={{ padding:"8px 12px", color:"var(--tx0)", fontWeight:700, textAlign:"right" }}>{eur(total)} €</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:"1px solid var(--bdr2)", background:"var(--bg0)" }}>
                <td colSpan={5} style={{ padding:"8px 12px", color:"var(--tx3)", fontSize:11 }}>
                  HBS base: {eur(HBS_RATE)} €/h · Total equipo: 21 personas
                </td>
                <td style={{ padding:"8px 12px", color:"var(--tx0)", fontWeight:800, textAlign:"right" }}>
                  {PPT_PERFILES.reduce((s,p)=>s+p.count*20,0)}h
                </td>
                <td style={{ padding:"8px 12px", color:"#f97316", fontWeight:800, textAlign:"right" }}>
                  SUBTOTAL PEM: {eur(PPT_PERFILES.reduce((s,p)=>s+p.count*20*p.precioH,0))} €
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Desglose por fase */}
      <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, padding:"18px 22px" }}>
        <div style={{ color:"var(--tx0)", fontWeight:700, fontSize:13, marginBottom:16 }}>📊 Presupuesto de Licitación por Fase</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:12 }}>
          <PhaseCard label="S0 — Devising a Project" color="#6366f1" hours={S0_HOURS} bud={s0bud}
            realH={s0RealH !== S0_HOURS ? s0RealH : null} realBud={s0RealH !== S0_HOURS ? calcBudget(calcPEM(s0RealH)) : null} />
          <PhaseCard label="Sprint 1" color="#818cf8" hours={sprintH[1]} bud={s1bud} isEstim
            realH={s1RealH} realBud={s1real} />
          <PhaseCard label="Sprint 2" color="#34d399" hours={sprintH[2]} bud={s2bud} isEstim
            realH={s2RealH} realBud={s2real} />
          <PhaseCard label="Sprint 3" color="#fbbf24" hours={sprintH[3]} bud={s3bud} isEstim
            realH={s3RealH} realBud={s3real} />
        </div>

        {/* Total proyecto */}
        <div style={{ background:"var(--bg0)", border:"1px solid var(--bdr2)", borderRadius:10, padding:"16px 18px", marginTop:14 }}>
          <div style={{ color:"var(--tx0)", fontWeight:700, fontSize:13, marginBottom:10 }}>TOTAL PROYECTO (Estimado)</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:10, marginBottom:12, fontSize:11 }}>
            {[
              { l:"PEM",              v: totbud.pem,  c:"#a1a1aa" },
              { l:`GG (${(GG_PCT*100).toFixed(0)}%)`, v: totbud.gg,   c:"var(--tx3)" },
              { l:`BI (${(BI_PCT*100).toFixed(0)}%)`,  v: totbud.bi,   c:"var(--tx3)" },
              { l:"Base Imponible",   v: totbud.base, c:"var(--tx0)" },
              { l:`IVA (${(IVA_PCT*100).toFixed(0)}%)`,v: totbud.iva,  c:"var(--tx3)" },
              { l:"TOTAL CON IVA",    v: totbud.total,c:"#818cf8" },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ background:"var(--bg2)", borderRadius:7, padding:"10px 12px" }}>
                <div style={{ color:"var(--tx4)", fontSize:10 }}>{l}</div>
                <div style={{ color:c, fontWeight:700, fontSize:15 }}>{eur(v)} €</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Estado presupuesto global */}
      <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, padding:"18px 22px" }}>
        <div style={{ color:"var(--tx0)", fontWeight:700, fontSize:13, marginBottom:16 }}>📈 Estado del Presupuesto Global</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16, fontSize:11 }}>
          <div style={{ background:"var(--bg0)", borderRadius:8, padding:"12px 14px" }}>
            <div style={{ color:"var(--tx4)", fontSize:10, marginBottom:3 }}>PRESUPUESTO TOTAL ADJUDICADO</div>
            <div style={{ color:"var(--tx0)", fontWeight:800, fontSize:18 }}>150.000,00 €</div>
            <div style={{ color:"var(--tx3)" }}>IVA incluido</div>
          </div>
          <div style={{ background:"var(--bg0)", borderRadius:8, padding:"12px 14px" }}>
            <div style={{ color:"var(--tx4)", fontSize:10, marginBottom:3 }}>GASTO ACUMULADO (S0 + S1)</div>
            <div style={{ color:"#f43f5e", fontWeight:800, fontSize:18 }}>{eur(gastadoAcum)} €</div>
            <div style={{ color:"var(--tx3)" }}>S0 real + S1 real Clockify</div>
          </div>
          <div style={{ background:"var(--bg0)", borderRadius:8, padding:"12px 14px" }}>
            <div style={{ color:"var(--tx4)", fontSize:10, marginBottom:3 }}>REMANENTE PRESUPUESTARIO</div>
            <div style={{ color:"#34d399", fontWeight:800, fontSize:18 }}>{eur(remanente)} €</div>
            <div style={{ color:"var(--tx3)" }}>Disponible para S2 + S3</div>
          </div>
        </div>
        <div style={{ marginBottom:6 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--tx3)", marginBottom:5 }}>
            <span>Grado de Ejecución Presupuestaria</span>
            <span style={{ color: ejecucion < 15 ? "#34d399" : "#f87171", fontWeight:700, fontSize:13 }}>
              {ejecucion.toFixed(2)} %
            </span>
          </div>
          <div style={{ height:12, background:"var(--bdr)", borderRadius:6, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${Math.min(ejecucion,100)}%`,
              background: ejecucion < 15 ? "#34d399" : "#f87171", borderRadius:6, transition:"width .5s" }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:4, fontSize:10, color:"var(--bdr2)" }}>
            <span>0 €</span>
            <span style={{ color:"var(--tx4)" }}>↑ Umbral lineal estimado: ~15 %</span>
            <span>150.000 €</span>
          </div>
        </div>
        {ejecucion < 15 && (
          <div style={{ marginTop:12, background:"#34d39910", border:"1px solid #34d39930", borderRadius:8, padding:"10px 14px", fontSize:11, color:"#059669" }}>
            ✅ El gasto se mantiene por debajo del umbral lineal esperado por Sprint (~15%). Gestión eficiente de recursos — remanente mayor disponible para fases de mayor intensidad.
          </div>
        )}
      </div>

      {/* Nota metodológica */}
      <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:8, padding:"10px 16px", color:"var(--tx4)", fontSize:11 }}>
        📄 Metodología: PPT Junta de Andalucía · HBS {eur(HBS_RATE)}€/h · GG {(GG_PCT*100).toFixed(0)}% · BI {(BI_PCT*100).toFixed(0)}% · IVA {(IVA_PCT*100).toFixed(0)}%.
        Horas S0 y S1: datos reales Clockify. Sprints S2-S3: estimación por tamaños backlog (XS=2h · S=4h · M=8h · L=16h · XL=24h).
        Composición: 1 PO (Jefe de Proyecto) + 1 SM (Consultor) + 4 Coordinadores + 15 Programadores.
      </div>
    </div>
  );
}
