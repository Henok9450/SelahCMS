// shared/pipes/to-date.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';

@Pipe({
  name: 'toDate',
  standalone: true
})
export class ToDatePipe implements PipeTransform {
  transform(value: Date | Timestamp | undefined | null): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    return (value as Timestamp).toDate();
  }
}