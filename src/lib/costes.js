// Tarifas PPT — Pliego de Prescripciones Técnicas (Junta de Andalucía)
const HBS_RATE          = 25.50;    // Hora Básica de Servicio (€/h)
const GG_PCT            = 0.13;     // Gastos Generales (13 %)
const BI_PCT            = 0.06;     // Beneficio Industrial (6 %)
const IVA_PCT           = 0.21;     // IVA (21 %)
const PRESUPUESTO_TOTAL = 150_000;  // Presupuesto total adjudicado (IVA inc.)

// PEM: distribuir horas equitativamente entre los 21 miembros por perfil
// Cálculo manual basado en estructura: 1 PO (56.10), 1 SM (43.35), 6 Coords (36.21), 13 Devs (28.56)
export function calcPEM(totalH) {
  const hPP = totalH / 21;
  return (1 * hPP * 56.10) + (1 * hPP * 43.35) + (6 * hPP * 36.21) + (13 * hPP * 28.56);
}

// Presupuesto completo: PEM → GG → BI → Base Imponible → IVA → Total
export function calcBudget(pem) {
  const gg   = pem * GG_PCT;
  const bi   = pem * BI_PCT;
  const base = pem + gg + bi;
  const iva  = base * IVA_PCT;
  return { pem, gg, bi, base, iva, total: base + iva };
}

export { HBS_RATE, GG_PCT, BI_PCT, IVA_PCT, PRESUPUESTO_TOTAL };
