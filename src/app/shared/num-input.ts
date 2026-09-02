export function numFromEvent(e: Event): number {
  const v = (e.target as HTMLInputElement).valueAsNumber;
  return isNaN(v) ? 0 : v;
}
