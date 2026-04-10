import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'filesize', standalone: true })
export class FilesizePipe implements PipeTransform {
    private units = ['B', 'KB', 'MB', 'GB', 'TB'];

    transform(bytes: number | null | undefined): string {
        if (bytes == null || bytes <= 0) return '—';

        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        const size = bytes / Math.pow(1024, i);
        const unit = this.units[Math.min(i, this.units.length - 1)];

        return `${size < 10 ? size.toFixed(1) : Math.round(size)} ${unit}`;
    }
}
