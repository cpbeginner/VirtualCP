export function nowUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function yearRangeUtcSeconds(year: number): { start: number; end: number } {
  const start = Math.floor(Date.UTC(year, 0, 1) / 1000);
  const end = Math.floor(Date.UTC(year + 1, 0, 1) / 1000);
  return { start, end };
}
