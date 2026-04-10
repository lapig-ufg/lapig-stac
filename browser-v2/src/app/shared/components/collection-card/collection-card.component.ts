import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';
import { StacCollection } from '@/app/core/models/stac.types';
import { TruncatePipe } from '@/app/shared/pipes/truncate.pipe';

@Component({
    selector: 'app-collection-card',
    standalone: true,
    imports: [CommonModule, CardModule, ChipModule, BadgeModule, TooltipModule, TruncatePipe],
    styles: `
        :host {
            display: block;
        }
        .collection-card {
            cursor: pointer;
            transition: transform 120ms ease, box-shadow 120ms ease;
            overflow: hidden;
            height: 100%;
        }
        .collection-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(27, 58, 42, 0.12);
        }
        .collection-thumb {
            aspect-ratio: 16 / 9;
            object-fit: cover;
            width: 100%;
            display: block;
        }
        .collection-thumb-placeholder {
            aspect-ratio: 16 / 9;
            width: 100%;
            background: linear-gradient(135deg, #1B3A2A 0%, #429B4D 100%);
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .collection-thumb-placeholder i {
            font-size: 2.5rem;
            color: rgba(255, 255, 255, 0.4);
        }
    `,
    template: `
        <div class="card p-0 collection-card" (click)="navigate.emit(collection().id)">
            @if (thumbnailUrl()) {
                <img [src]="thumbnailUrl()" [alt]="collection().title || collection().id" class="collection-thumb" loading="lazy" />
            } @else {
                <div class="collection-thumb-placeholder">
                    <i class="pi pi-map"></i>
                </div>
            }

            <div class="p-4">
                @if (providerName()) {
                    <span class="text-xs uppercase tracking-widest font-mono" style="color: var(--color-cerrado-gold, #C4933F); letter-spacing: 0.12em;">
                        {{ providerName() }}
                    </span>
                }

                <h3 class="text-lg font-bold mt-1 mb-2" style="font-family: var(--font-display, 'Exo 2'), system-ui, sans-serif; line-height: 1.25;">
                    {{ collection().title || collection().id }}
                </h3>

                <p class="text-sm text-muted-color line-clamp-2 mb-3" style="line-height: 1.5;">
                    {{ collection().description | truncate: 160 }}
                </p>

                <div class="flex items-center gap-3 text-xs text-muted-color mb-3">
                    @if (temporalExtent()) {
                        <span class="flex items-center gap-1">
                            <i class="pi pi-calendar text-xs"></i>
                            {{ temporalExtent() }}
                        </span>
                    }
                    @if (collection().license) {
                        <span class="flex items-center gap-1">
                            <i class="pi pi-file text-xs"></i>
                            {{ collection().license }}
                        </span>
                    }
                </div>

                @if (keywords().length > 0) {
                    <div class="flex flex-wrap gap-1">
                        @for (keyword of keywords().slice(0, 3); track keyword) {
                            <p-chip [label]="keyword" styleClass="text-xs" />
                        }
                        @if (keywords().length > 3) {
                            <p-chip [label]="'+' + (keywords().length - 3)" styleClass="text-xs" />
                        }
                    </div>
                }
            </div>
        </div>
    `
})
export class CollectionCardComponent {
    collection = input.required<StacCollection>();
    navigate = output<string>();

    thumbnailUrl = input<string | undefined>(undefined);

    providerName(): string {
        const providers = this.collection().providers;
        if (!providers || providers.length === 0) return '';
        return providers[0].name;
    }

    temporalExtent(): string {
        const interval = this.collection().extent?.temporal?.interval;
        if (!interval || interval.length === 0) return '';
        const [start, end] = interval[0];
        const fmtYear = (iso: string | null) => {
            if (!iso) return '...';
            const d = new Date(iso);
            return isNaN(d.getTime()) ? iso : d.getUTCFullYear().toString();
        };
        return `${fmtYear(start)} – ${fmtYear(end)}`;
    }

    keywords(): string[] {
        return this.collection().keywords ?? [];
    }
}
