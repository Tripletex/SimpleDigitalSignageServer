/**
 * Generate a UUIDv7 (time-ordered UUID).
 * Layout: 48-bit unix_ts_ms | 4-bit version (0111) | 12-bit rand_a | 2-bit variant (10) | 62-bit rand_b
 */
export function uuidv7(): string {
  const now = Date.now();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Timestamp (48 bits, big-endian) into bytes 0-5
  bytes[0] = (now / 2 ** 40) & 0xff;
  bytes[1] = (now / 2 ** 32) & 0xff;
  bytes[2] = (now / 2 ** 24) & 0xff;
  bytes[3] = (now / 2 ** 16) & 0xff;
  bytes[4] = (now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;

  // Version 7 (0111) in bits 48-51
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  // Variant 10 in bits 64-65
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function generateUUID(): string {
  return uuidv7();
}

export function isNullOrUndefined(value: unknown): boolean {
  return value === null || value === undefined;
}

export function safeJsonParse<T>(jsonString: string | null | undefined, defaultValue: T): T {
  if (!jsonString) return defaultValue;
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return defaultValue;
  }
}

export function formatDateOrNull(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}
