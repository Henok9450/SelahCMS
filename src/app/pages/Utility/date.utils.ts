import { Timestamp } from 'firebase/firestore';

export function convertToDate(value: Date | Timestamp | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  return value;
}