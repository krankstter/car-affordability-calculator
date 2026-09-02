export function fmtINR(n: number): string {
  if (!isFinite(n)) n = 0;
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

export function fmtPct(n: number): string {
  return (isFinite(n) ? n : 0).toFixed(1) + '%';
}
