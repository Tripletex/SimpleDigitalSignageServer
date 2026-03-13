import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a random UUID
 */
export function generateUUID(): string {
  return uuidv4();
}

/**
 * Helper function to check if a value is null or undefined
 */
export function isNullOrUndefined(value: any): boolean {
  return value === null || value === undefined;
}

/**
 * Helper function to safely parse JSON
 * @param jsonString - JSON string to parse
 * @param defaultValue - Default value to return if parsing fails
 */
export function safeJsonParse<T>(jsonString: string | null | undefined, defaultValue: T): T {
  if (!jsonString) return defaultValue;
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return defaultValue;
  }
}

/**
 * Helper function to format a date as ISO string or null
 */
export function formatDateOrNull(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}