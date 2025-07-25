import { Timestamp } from '@angular/fire/firestore';

/**
 * Safely converts various date input types (string, Date, Timestamp) to a JavaScript Date object.
 * Returns null if the input is null, undefined, or cannot be parsed into a valid date.
 * @param value The date input, which can be a string, Date object, Firestore Timestamp, or null/undefined.
 * @returns A JavaScript Date object or null.
 */
export function convertToDate(value: string | Date | Timestamp | undefined | null): Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    // If it's already a Date object, return it as is.
    return value;
  }
  if (value instanceof Timestamp) {
    // If it's a Firestore Timestamp, convert it to a JavaScript Date.
    return value.toDate();
  }
  if (typeof value === 'string') {
    // If it's a string, try to parse it into a Date.
    const parsedDate = new Date(value);
    // Check if the parsed date is valid (e.g., prevents "Invalid Date" errors).
    return isNaN(parsedDate.getTime()) ? null : parsedDate;
  }
  // For any other unexpected type, return null.
  return null;
}

/**
 * Ensures that a given value is a valid JavaScript Date object.
 * This function simply delegates to convertToDate, providing a consistent API for date validation/conversion.
 * @param date The value to check/convert.
 * @returns A JavaScript Date object or null.
 */
export function ensureValidDate(date: any): Date | null {
    return convertToDate(date);
}