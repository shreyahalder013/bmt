const hits = new Map<string, number[]>();
export function limited(ip: string, max = 5) { const now = Date.now(); const recent = (hits.get(ip) ?? []).filter(t => now - t < 3600000); recent.push(now); hits.set(ip, recent); return recent.length > max; }
