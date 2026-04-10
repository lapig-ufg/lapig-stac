import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'truncate', standalone: true })
export class TruncatePipe implements PipeTransform {
    transform(value: string | null | undefined, maxLength = 100): string {
        if (!value) return '';
        if (value.length <= maxLength) return value;
        return value.substring(0, maxLength).trimEnd() + '...';
    }
}
