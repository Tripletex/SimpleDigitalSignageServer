import type { NetworkInterface } from '../types.ts';

export function getNetworkInterfaces(): NetworkInterface[] {
  try {
    const interfaces = Deno.networkInterfaces();
    const grouped = new Map<string, string[]>();

    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.address.startsWith('127.')) {
        const existing = grouped.get(iface.name) || [];
        existing.push(iface.address);
        grouped.set(iface.name, existing);
      }
    }

    return Array.from(grouped.entries()).map(([name, ips]) => ({
      name,
      ipAddress: ips,
    }));
  } catch {
    return [];
  }
}
