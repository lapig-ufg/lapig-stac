import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { StacAsset } from '@/app/core/models/stac.types';
import { ClipboardService } from '@/app/core/services/clipboard.service';
import type { ClassificationEntry } from '@/app/features/map/models/cog-style.types';
import { parseSldToClassification } from '@/app/features/map/utils/sld-parser.utils';

interface StyleEntry {
    key: string;
    asset: StacAsset;
    label: string;
    icon: string;
}

const STYLE_LABELS: Record<string, string> = {
    'application/vnd.ogc.sld+xml': 'SLD',
    'application/x-qgis-style': 'QML',
    'application/json': 'JSON Style',
    'application/vnd.mapbox.style+json': 'Mapbox Style'
};

@Component({
    selector: 'app-style-list',
    standalone: true,
    imports: [CommonModule, ButtonModule, BadgeModule, TooltipModule, TranslatePipe],
    styles: `
        .style-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.6rem 0;
            border-bottom: 1px solid var(--surface-border);
        }
        .style-item:last-child { border-bottom: none; }
        .style-icon {
            width: 36px;
            height: 36px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--p-surface-100);
            color: var(--p-primary-color);
            flex-shrink: 0;
        }
        .style-info { flex: 1; min-width: 0; }
        .style-name {
            font-weight: 600;
            font-size: 0.85rem;
        }
        .style-type {
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
            font-size: 0.7rem;
            color: var(--text-color-secondary);
        }
    `,
    template: `
        @if (styleEntries().length > 0) {
            <div>
                <h4 class="font-mono text-xs uppercase tracking-widest mb-3" style="color: var(--color-cerrado-gold, #C4933F); letter-spacing: 0.1em;">
                    {{ 'styles.title' | translate }}
                </h4>
                @for (entry of styleEntries(); track entry.key) {
                    <div class="style-item">
                        <div class="style-icon">
                            <i [class]="entry.icon"></i>
                        </div>
                        <div class="style-info">
                            <div class="style-name">{{ entry.label }}</div>
                            <div class="style-type">{{ entry.asset.type }}</div>
                        </div>
                        @if (isSld(entry.asset)) {
                            <p-button icon="pi pi-palette" [rounded]="true" [text]="true" size="small" pTooltip="Aplicar ao mapa" tooltipPosition="left" (onClick)="applySld(entry.asset.href)" />
                        }
                        <a [href]="entry.asset.href" target="_blank" download>
                            <p-button icon="pi pi-download" [rounded]="true" [text]="true" size="small" [pTooltip]="'styles.download' | translate" tooltipPosition="left" />
                        </a>
                        <p-button icon="pi pi-copy" [rounded]="true" [text]="true" size="small" [pTooltip]="'styles.copyUrl' | translate" tooltipPosition="left" (onClick)="copyUrl(entry.asset.href)" />
                    </div>
                }
            </div>
        }
    `
})
export class StyleListComponent {
    private clipboard = inject(ClipboardService);
    private http = inject(HttpClient);

    /** Assets de estilo (role 'style') da coleção */
    styles = input.required<Record<string, StacAsset>>();
    /** Base URL para resolver hrefs relativos */
    baseUrl = input<string>('');
    /** Emitido ao aplicar um SLD parseado ao mapa */
    applyStyle = output<ClassificationEntry[]>();

    styleEntries(): StyleEntry[] {
        const assets = this.styles();
        if (!assets) return [];
        return Object.entries(assets)
            .filter(([, asset]) => asset.roles?.includes('style'))
            .map(([key, asset]) => {
                const resolvedAsset = { ...asset };
                if (resolvedAsset.href && !resolvedAsset.href.startsWith('http')) {
                    resolvedAsset.href = `${this.baseUrl()}/${resolvedAsset.href.replace(/^\.\//, '')}`;
                }
                return {
                    key,
                    asset: resolvedAsset,
                    label: STYLE_LABELS[asset.type ?? ''] ?? key,
                    icon: asset.type?.includes('sld') ? 'pi pi-palette' : asset.type?.includes('qgis') ? 'pi pi-map' : 'pi pi-file'
                };
            });
    }

    isSld(asset: StacAsset): boolean {
        return asset.type?.includes('sld') ?? false;
    }

    applySld(href: string) {
        this.http.get(href, { responseType: 'text' }).subscribe({
            next: (xml) => {
                const classes = parseSldToClassification(xml);
                if (classes.length) {
                    this.applyStyle.emit(classes);
                }
            },
            error: (err) => console.error('[StyleList] Erro ao carregar SLD:', err)
        });
    }

    copyUrl(href: string) {
        this.clipboard.copyToClipboard(href, 'URL do estilo');
    }
}
