export async function mapLimit<T, R>(xs: T[], limit: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(xs.length);
  let next = 0;
  const worker = async () => { while (next < xs.length) { const i = next++; out[i] = await fn(xs[i], i); } };
  await Promise.all(Array.from({ length: Math.min(limit, xs.length) }, worker));
  return out;
}
