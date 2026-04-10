import { Component, input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';
import { StacAsset } from '@/app/core/models/stac.types';
import { FilesizePipe } from '@/app/shared/pipes/filesize.pipe';
import { ClipboardService } from '@/app/core/services/clipboard.service';

interface AssetEntry {
    key: string;
    asset: StacAsset;
}

const MIME_LABELS: Record<string, string> = {
    'image/tiff': 'GeoTIFF',
    'application/x-geotiff': 'GeoTIFF',
    'image/tiff; application=geotiff': 'GeoTIFF',
    'image/tiff; application=geotiff; profile=cloud-optimized': 'COG',
    'image/png': 'PNG',
    'image/jpeg': 'JPEG',
    'application/json': 'JSON',
    'application/geo+json': 'GeoJSON',
    'application/geopackage+sqlite3': 'GPKG',
    'text/xml': 'XML',
    'text/html': 'HTML',
    'application/xml': 'XML',
    'application/pdf': 'PDF'
};

@Component({
    selector: 'app-asset-list',
    standalone: true,
    imports: [CommonModule, TableModule, ButtonModule, BadgeModule, TooltipModule, FilesizePipe],
    styles: `
        :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td {
            vertical-align: top;
        }
        .asset-title {
            font-weight: 600;
            font-size: 0.875rem;
        }
        .asset-description {
            font-size: 0.8rem;
            color: var(--text-color-secondary);
            margin-top: 0.25rem;
        }
        .asset-href {
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
            font-size: 0.7rem;
            color: var(--text-color-secondary);
            word-break: break-all;
            margin-top: 0.25rem;
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    `,
    template: `
        @if (assetEntries().length === 0) {
            <div class="text-center py-6 text-muted-color">
                <i class="pi pi-box text-3xl mb-2"></i>
                <p>Nenhum asset disponível.</p>
            </div>
        } @else {
            <p-table [value]="assetEntries()" styleClass="p-datatable-sm" [rowHover]="true">
                <ng-template #header>
                    <tr>
                        <th>Asset</th>
                        <th style="width: 80px;">Tipo</th>
                        <th style="width: 140px;">Roles</th>
                        <th style="width: 80px;">Tamanho</th>
                        <th style="width: 100px;" class="text-right">Ações</th>
                    </tr>
                </ng-template>
                <ng-template #body let-entry>
                    <tr>
                        <td>
                            <span class="asset-title">{{ entry.asset.title || entry.key }}</span>
                            @if (entry.asset.description) {
                                <p class="asset-description">{{ entry.asset.description }}</p>
                            }
                            <p class="asset-href" [pTooltip]="entry.asset.href" tooltipPosition="bottom">{{ entry.asset.href }}</p>
                        </td>
                        <td>
                            <p-badge [value]="getMimeLabel(entry.asset.type)" severity="info" />
                        </td>
                        <td>
                            <div class="flex flex-wrap gap-1">
                                @for (role of entry.asset.roles || []; track role) {
                                    <p-badge [value]="role" severity="secondary" />
                                }
                            </div>
                        </td>
                        <td>
                            <span class="font-mono text-xs">{{ entry.asset['file:size'] | filesize }}</span>
                        </td>
                        <td class="text-right">
                            <div class="flex justify-end gap-1">
                                <a [href]="entry.asset.href" target="_blank" rel="noopener" download>
                                    <p-button icon="pi pi-download" [rounded]="true" [text]="true" size="small" pTooltip="Download" tooltipPosition="left" />
                                </a>
                                <p-button icon="pi pi-copy" [rounded]="true" [text]="true" size="small" pTooltip="Copiar URL" tooltipPosition="left" (onClick)="copyUrl(entry.asset.href)" />
                            </div>
                        </td>
                    </tr>
                </ng-template>
            </p-table>
        }
    `
})
export class AssetListComponent {
    private clipboard = inject(ClipboardService);

    assets = input.required<Record<string, StacAsset>>();

    assetEntries = computed<AssetEntry[]>(() => {
        const assets = this.assets();
        if (!assets) return [];
        return Object.entries(assets).map(([key, asset]) => ({ key, asset }));
    });

    getMimeLabel(type?: string): string {
        if (!type) return '—';
        return MIME_LABELS[type.toLowerCase()] ?? type.split('/').pop()?.toUpperCase() ?? type;
    }

    copyUrl(href: string) {
        this.clipboard.copyToClipboard(href, 'URL do asset');
    }
}
