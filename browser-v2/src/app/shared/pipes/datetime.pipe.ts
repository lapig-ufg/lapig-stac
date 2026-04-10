import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'stacDatetime', standalone: true })
export class StacDatetimePipe implements PipeTransform {
    private months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    transform(value: string | null | undefined, format: 'short' | 'full' | 'range' = 'short'): string {
        if (!value) return '—';

        // Intervalo STAC: "2020-01-01T00:00:00Z/2024-12-31T23:59:59Z" ou "../.."
        if (value.includes('/')) {
            return this.formatInterval(value);
        }

        return this.formatSingle(value, format);
    }

    private formatInterval(interval: string): string {
        const [start, end] = interval.split('/');
        const startStr = start === '..' ? '...' : this.formatSingle(start, 'short');
        const endStr = end === '..' ? 'presente' : this.formatSingle(end, 'short');
        return `${startStr} – ${endStr}`;
    }

    private formatSingle(iso: string, format: 'short' | 'full' | 'range'): string {
        const date = new Date(iso);
        if (isNaN(date.getTime())) return iso;

        const day = date.getUTCDate();
        const month = this.months[date.getUTCMonth()];
        const year = date.getUTCFullYear();

        if (format === 'full') {
            const hours = date.getUTCHours().toString().padStart(2, '0');
            const minutes = date.getUTCMinutes().toString().padStart(2, '0');
            return `${day} ${month} ${year} ${hours}:${minutes} UTC`;
        }

        return `${day} ${month} ${year}`;
    }
}
