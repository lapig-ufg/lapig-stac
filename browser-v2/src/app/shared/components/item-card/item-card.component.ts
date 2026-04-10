import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';
import { StacItem } from '@/app/core/models/stac.types';
import { StacDatetimePipe } from '@/app/shared/pipes/datetime.pipe';
import { FilesizePipe } from '@/app/shared/pipes/filesize.pipe';

@Component({
    selector: 'app-item-card',
    standalone: true,
    imports: [CommonModule, BadgeModule, TooltipModule, StacDatetimePipe, FilesizePipe],
    styles: `
        :host { display: block; }

        .item-card {
            cursor: pointer;
            transition: transform 120ms ease, box-shadow 120ms ease;
            overflow: hidden;
            height: 100%;
            display: flex;
            flex-direction: column;
        }
        .item-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(27, 58, 42, 0.12);
        }

        /* Thumbnail */
        .item-thumb {
            aspect-ratio: 4 / 3;
            object-fit: cover;
            width: 100%;
            display: block;
        }
        .item-thumb-placeholder {
            aspect-ratio: 4 / 3;
            width: 100%;
            background: linear-gradient(135deg, var(--color-tech-teal, #2A9D8F) 0%, var(--color-cerrado-green, #429B4D) 100%);
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .item-thumb-placeholder i {
            font-size: 2rem;
            color: rgba(255, 255, 255, 0.35);
        }

        /* Overlay badges */
        .cloud-badge {
            position: absolute;
            top: 8px;
            right: 8px;
        }
        .collection-label {
            position: absolute;
            top: 8px;
            left: 8px;
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
            font-size: 0.625rem;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            background: rgba(27, 58, 42, 0.75);
            color: var(--color-gold-pale, #EDD9A3);
            padding: 2px 8px;
            border-radius: 4px;
            backdrop-filter: blur(4px);
            max-width: 60%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .asset-count-badge {
            position: absolute;
            bottom: 8px;
            right: 8px;
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
            font-size: 0.65rem;
            font-weight: 500;
            background: rgba(27, 58, 42, 0.7);
            color: rgba(255, 255, 255, 0.9);
            padding: 2px 6px;
            border-radius: 4px;
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            gap: 3px;
        }

        /* Title */
        .item-title {
            font-family: var(--font-display, 'Exo 2'), system-ui, sans-serif;
            font-size: 0.875rem;
            font-weight: 700;
            line-height: 1.3;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            margin: 0;
        }

        /* Metadata chips */
        .meta-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            padding: 0 12px 8px;
            min-height: 0;
        }
        .meta-chip {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            font-size: 0.65rem;
            font-weight: 500;
            padding: 1px 6px;
            border-radius: 4px;
            background: var(--p-surface-100, var(--surface-hover, rgba(0, 0, 0, 0.04)));
            color: var(--text-color-secondary);
            white-space: nowrap;
        }
        .meta-chip-mono {
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
        }

        /* Footer */
        .item-footer {
            margin-top: auto;
            padding: 8px 12px;
            border-top: 1px solid var(--p-content-border-color, var(--surface-border, rgba(0, 0, 0, 0.06)));
            font-size: 0.75rem;
            color: var(--text-color-secondary);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
    `,
    template: `
        <div class="card p-0 item-card" (click)="navigate.emit(item().id)">
            <!-- Zona 1: Thumbnail com overlays -->
            <div class="relative">
                @if (thumbnailUrl()) {
                    <img [src]="thumbnailUrl()" [alt]="title()" class="item-thumb" loading="lazy" />
                } @else {
                    <div class="item-thumb-placeholder">
                        <i class="pi pi-image"></i>
                    </div>
                }

                @if (collectionLabel()) {
                    <span class="collection-label">{{ collectionLabel() }}</span>
                }

                @if (cloudCover() !== null) {
                    <span class="cloud-badge">
                        <p-badge
                            [value]="cloudCover() + '% ☁'"
                            [severity]="cloudCoverSeverity()"
                            pTooltip="Cobertura de nuvens"
                            tooltipPosition="left"
                        />
                    </span>
                }

                <span class="asset-count-badge">
                    <i class="pi pi-box text-xs"></i> {{ assetCount() }}
                </span>
            </div>

            <!-- Zona 2: Título -->
            <div class="p-3 pb-2">
                <h4 class="item-title">{{ title() }}</h4>
            </div>

            <!-- Zona 3: Chips de metadados contextuais -->
            @if (hasMetadata()) {
                <div class="meta-chips">
                    @if (platform()) {
                        <span class="meta-chip" pTooltip="Plataforma">
                            <i class="pi pi-globe text-xs"></i> {{ platform() }}
                        </span>
                    }
                    @if (epsg()) {
                        <span class="meta-chip meta-chip-mono" pTooltip="Sistema de referência">
                            {{ epsg() }}
                        </span>
                    }
                    @if (resolution()) {
                        <span class="meta-chip meta-chip-mono" pTooltip="Dimensao do raster">
                            <i class="pi pi-th-large text-xs"></i> {{ resolution() }}
                        </span>
                    }
                    @if (gsd()) {
                        <span class="meta-chip meta-chip-mono" pTooltip="Resolucao espacial">
                            {{ gsd() }}
                        </span>
                    }
                    @if (bands()) {
                        <span class="meta-chip" pTooltip="Bandas espectrais">
                            <i class="pi pi-palette text-xs"></i> {{ bands() }} bandas
                        </span>
                    }
                    @if (sarInfo()) {
                        <span class="meta-chip meta-chip-mono" pTooltip="SAR">
                            {{ sarInfo() }}
                        </span>
                    }
                    @if (totalSize()) {
                        <span class="meta-chip meta-chip-mono" pTooltip="Tamanho total dos assets">
                            <i class="pi pi-database text-xs"></i> {{ totalSize() | filesize }}
                        </span>
                    }
                </div>
            }

            <!-- Zona 4: Footer com data -->
            <div class="item-footer">
                <span class="flex items-center gap-1">
                    <i class="pi pi-calendar text-xs"></i>
                    {{ datetime() | stacDatetime }}
                </span>
            </div>
        </div>
    `
})
export class ItemCardComponent {
    item = input.required<StacItem>();
    navigate = output<string>();

    title = computed(() => this.item().properties.title || this.item().id);

    collectionLabel = computed(() => this.item().collection || null);

    thumbnailUrl = computed(() => {
        const assets = this.item().assets;
        return assets['thumbnail']?.href ?? assets['overview']?.href;
    });

    cloudCover = computed(() => {
        const cc = this.item().properties['eo:cloud_cover'];
        return typeof cc === 'number' ? Math.round(cc) : null;
    });

    cloudCoverSeverity = computed((): 'success' | 'warn' | 'danger' => {
        const cc = this.cloudCover();
        if (cc === null) return 'success';
        if (cc <= 20) return 'success';
        if (cc <= 50) return 'warn';
        return 'danger';
    });

    datetime = computed(() => {
        const props = this.item().properties;
        if (props.datetime) return props.datetime;
        if (props.start_datetime && props.end_datetime)
            return `${props.start_datetime}/${props.end_datetime}`;
        return props.start_datetime || props.end_datetime || null;
    });

    epsg = computed(() => {
        const epsg = this.item().properties['proj:epsg'];
        return typeof epsg === 'number' ? `EPSG:${epsg}` : null;
    });

    resolution = computed(() => {
        const shape = this.item().properties['proj:shape'];
        if (!Array.isArray(shape) || shape.length < 2) return null;
        return `${shape[1]}\u00D7${shape[0]} px`;
    });

    gsd = computed(() => {
        const gsd = this.item().properties['gsd'];
        return typeof gsd === 'number' ? `${gsd}m GSD` : null;
    });

    platform = computed(() => {
        const p = this.item().properties['platform'] || this.item().properties['constellation'];
        return typeof p === 'string' ? p : null;
    });

    assetCount = computed(() => Object.keys(this.item().assets).length);

    totalSize = computed(() => {
        let total = 0;
        for (const asset of Object.values(this.item().assets)) {
            if (typeof asset['file:size'] === 'number') total += asset['file:size'];
        }
        return total > 0 ? total : null;
    });

    bands = computed(() => {
        const eoBands = this.item().properties['eo:bands'];
        return Array.isArray(eoBands) ? eoBands.length : null;
    });

    sarInfo = computed(() => {
        const mode = this.item().properties['sar:instrument_mode'];
        const pols = this.item().properties['sar:polarizations'];
        if (!mode && !pols) return null;
        const parts: string[] = [];
        if (mode) parts.push(String(mode));
        if (Array.isArray(pols)) parts.push(pols.join('+'));
        return parts.join(' ');
    });

    hasMetadata = computed(() =>
        !!(this.platform() || this.epsg() || this.resolution() || this.gsd() || this.bands() || this.sarInfo() || this.totalSize())
    );
}
