// Normalize DD/MM/YYYY → YYYY-MM-DD so sort() works correctly
export function normDate(d) {
  if (d && /^\d{2}\/\d{2}\/\d{4}$/.test(d))
    return `${d.slice(6)}-${d.slice(3,5)}-${d.slice(0,2)}`;
  return d;
}
