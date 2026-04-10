import { Component, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { PaginatorModule } from 'primeng/paginator';
import { StacApiService } from '@/app/core/services/stac-api.service';
import { StacCollection, StacItem, StacItemCollection, StacLink } from '@/app/core/models/stac.types';
import { SplitterModule } from 'primeng/splitter';
import { TranslatePipe } from '@ngx-translate/core';
import { ItemCardComponent } from '@/app/shared/components/item-card/item-card.component';
import { MapCanvasComponent } from '@/app/features/map/map-canvas.component';

@Component({
    selector: 'app-collection-detail',
    standalone: true,
    imports: [CommonModule, RouterModule, CardModule, ChipModule, ButtonModule, MessageModule, SkeletonModule, TagModule, TooltipModule, PaginatorModule, SplitterModule, TranslatePipe, ItemCardComponent, MapCanvasComponent],
    styles: `
        .description-text {
            line-height: 1.65;
            white-space: pre-line;
        }
        :host ::ng-deep .collection-splitter .p-splitterpanel {
            overflow: auto;
        }
        .map-panel-inner {
            height: 100%;
            min-height: 400px;
        }
        @media (max-width: 1023px) {
            .map-panel-inner {
                min-height: 280px;
            }
        }
    `,
    template: `
        <!-- Loading state -->
        @if (loadingCollection()) {
            <div class="card">
                <p-skeleton width="40%" height="0.65rem" styleClass="mb-3" />
                <p-skeleton width="60%" height="2rem" styleClass="mb-4" />
                <p-skeleton width="100%" height="1rem" styleClass="mb-2" />
                <p-skeleton width="90%" height="1rem" styleClass="mb-2" />
                <p-skeleton width="70%" height="1rem" />
            </div>
        }

        <!-- Error state -->
        @if (error()) {
            <p-message severity="error" [text]="error()!" styleClass="w-full mb-4" />
        }

        <!-- Collection loaded -->
        @if (collection(); as col) {
            <!-- Header + Map split view redimensionável -->
            <p-splitter [panelSizes]="[50, 50]" [minSizes]="[30, 30]" styleClass="mb-4 collection-splitter" [style]="{ 'min-height': '450px' }">
                <ng-template #panel>
                <div class="card h-full overflow-auto">
                    <div class="flex items-center gap-3 mb-4">
                        <p-button icon="pi pi-arrow-left" [text]="true" [rounded]="true" routerLink="/catalog" pTooltip="Voltar ao catálogo" />
                        <div>
                            <span class="font-mono text-xs uppercase tracking-widest" style="color: var(--color-cerrado-gold, #C4933F); letter-spacing: 0.12em;">
                                {{ 'collection.overline' | translate }}
                            </span>
                            <h1 class="text-2xl font-bold" style="font-family: var(--font-display, 'Exo 2'), system-ui, sans-serif; font-weight: 800; letter-spacing: -0.03em;">
                                {{ col.title || col.id }}
                            </h1>
                        </div>
                    </div>

                    @if (col.description) {
                        <p class="description-text text-muted-color mb-4">{{ col.description }}</p>
                    }

                    <div class="flex flex-wrap gap-4 mb-4 text-sm">
                        @if (temporalExtent()) {
                            <div class="flex items-center gap-2">
                                <i class="pi pi-calendar text-sm" style="color: var(--color-tech-teal, #2A9D8F);"></i>
                                <span class="font-mono text-xs">{{ temporalExtent() }}</span>
                            </div>
                        }
                        @if (spatialExtentText()) {
                            <div class="flex items-center gap-2">
                                <i class="pi pi-map-marker text-sm" style="color: var(--color-tech-teal, #2A9D8F);"></i>
                                <span class="font-mono text-xs">{{ spatialExtentText() }}</span>
                            </div>
                        }
                        @if (col.license) {
                            <div class="flex items-center gap-2">
                                <i class="pi pi-file text-sm" style="color: var(--color-tech-teal, #2A9D8F);"></i>
                                <span>{{ col.license }}</span>
                            </div>
                        }
                    </div>

                    @if (col.providers && col.providers.length > 0) {
                        <div class="flex flex-wrap gap-2 mb-4">
                            @for (provider of col.providers; track provider.name) {
                                <p-tag [value]="provider.name" severity="secondary" [rounded]="true" />
                            }
                        </div>
                    }

                    @if (col.keywords && col.keywords.length > 0) {
                        <div class="flex flex-wrap gap-1">
                            @for (keyword of col.keywords; track keyword) {
                                <p-chip [label]="keyword" styleClass="text-xs" />
                            }
                        </div>
                    }
                </div>

                </ng-template>
                <ng-template #panel>
                <div class="map-panel-inner">
                    <app-map-canvas
                        [footprints]="footprintsGeoJson()"
                        [fitBbox]="collectionBbox()"
                        (featureClick)="onMapFeatureClick($event)"
                    />
                </div>
                </ng-template>
            </p-splitter>

            <!-- Items section -->
            <div class="mb-4">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl font-bold" style="font-family: var(--font-display, 'Exo 2'), system-ui, sans-serif; font-weight: 700;">
                        {{ 'collection.items' | translate }}
                        @if (totalItems() !== null) {
                            <span class="text-sm font-normal text-muted-color ml-2">({{ totalItems() }})</span>
                        }
                    </h2>
                </div>

                @if (loadingItems()) {
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        @for (i of itemSkeletons; track i) {
                            <div class="card p-0 overflow-hidden">
                                <p-skeleton width="100%" height="140px" borderRadius="0" />
                                <div class="p-3">
                                    <p-skeleton width="80%" height="0.9rem" styleClass="mb-2" />
                                    <p-skeleton width="50%" height="0.75rem" />
                                </div>
                            </div>
                        }
                    </div>
                } @else if (items().length === 0) {
                    <div class="card text-center py-8">
                        <i class="pi pi-inbox text-4xl text-muted-color mb-3"></i>
                        <p class="text-muted-color">{{ 'collection.itemsEmpty' | translate }}</p>
                    </div>
                } @else {
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        @for (item of items(); track item.id) {
                            <app-item-card [item]="item" (navigate)="onItemNavigate($event)" />
                        }
                    </div>

                    @if (totalItems() !== null && totalItems()! > pageSize) {
                        <div class="mt-6">
                            <p-paginator
                                [rows]="pageSize"
                                [totalRecords]="totalItems()!"
                                [first]="first()"
                                (onPageChange)="onPageChange($event)"
                                [showFirstLastIcon]="false"
                            />
                        </div>
                    }
                }
            </div>
        }
    `
})
export class CollectionDetailComponent {
    private stacApi = inject(StacApiService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private destroyRef = inject(DestroyRef);

    collection = signal<StacCollection | null>(null);
    items = signal<StacItem[]>([]);
    loadingCollection = signal(true);
    loadingItems = signal(true);
    error = signal<string | null>(null);
    totalItems = signal<number | null>(null);
    nextLink = signal<StacLink | null>(null);
    prevLink = signal<StacLink | null>(null);

    collectionId = '';
    pageSize = 20;
    first = signal(0);
    itemSkeletons = Array.from({ length: 8 }, (_, i) => i);

    /** Bounding box da coleção para fitBbox do mapa */
    collectionBbox = computed<number[] | null>(() => {
        const col = this.collection();
        if (!col?.extent?.spatial?.bbox?.[0]) return null;
        return col.extent.spatial.bbox[0];
    });

    /** GeoJSON FeatureCollection dos items para footprints no mapa */
    footprintsGeoJson = computed<Record<string, unknown> | null>(() => {
        const itemList = this.items();
        if (itemList.length === 0) return null;

        const features = itemList
            .filter((item) => item.geometry)
            .map((item) => ({
                type: 'Feature' as const,
                id: item.id,
                geometry: item.geometry,
                properties: {
                    id: item.id,
                    title: item.properties.title || item.id,
                    datetime: item.properties.datetime,
                    collection: item.collection
                }
            }));

        return {
            type: 'FeatureCollection',
            features
        };
    });

    constructor() {
        this.collectionId = this.route.snapshot.paramMap.get('collectionId') ?? '';
        if (!this.collectionId) {
            this.error.set('Identificador da coleção não informado.');
            this.loadingCollection.set(false);
            this.loadingItems.set(false);
            return;
        }
        this.loadCollection();
    }

    private loadCollection() {
        this.stacApi.getCollection(this.collectionId).pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: (col) => {
                this.collection.set(col);
                this.loadingCollection.set(false);
                this.loadItems();
            },
            error: () => {
                this.error.set(`Erro ao carregar a coleção "${this.collectionId}".`);
                this.loadingCollection.set(false);
                this.loadingItems.set(false);
            }
        });
    }

    private loadItems() {
        this.loadingItems.set(true);
        this.stacApi.getItems(this.collectionId, 20).pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: (result) => this.processItemsResponse(result),
            error: () => {
                this.loadingItems.set(false);
            }
        });
    }

    loadPage(link: StacLink) {
        this.loadingItems.set(true);
        this.stacApi.followLink<StacItemCollection>(link).pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: (result: StacItemCollection) => this.processItemsResponse(result),
            error: () => {
                this.loadingItems.set(false);
            }
        });
    }

    private processItemsResponse(result: StacItemCollection) {
        this.items.set(result.features);
        this.totalItems.set(result.numberMatched ?? result.context?.matched ?? null);
        this.nextLink.set(result.links.find((l) => l.rel === 'next') ?? null);
        this.prevLink.set(result.links.find((l) => l.rel === 'prev' || l.rel === 'previous') ?? null);
        this.loadingItems.set(false);
    }

    temporalExtent(): string {
        const interval = this.collection()?.extent?.temporal?.interval;
        if (!interval || interval.length === 0) return '';
        const [start, end] = interval[0];
        const fmtYear = (iso: string | null) => {
            if (!iso) return 'presente';
            const d = new Date(iso);
            return isNaN(d.getTime()) ? iso : d.getUTCFullYear().toString();
        };
        return `${fmtYear(start)} – ${fmtYear(end)}`;
    }

    spatialExtentText(): string {
        const bbox = this.collection()?.extent?.spatial?.bbox;
        if (!bbox || bbox.length === 0) return '';
        const [west, south, east, north] = bbox[0];
        return `${south.toFixed(2)}°, ${west.toFixed(2)}° → ${north.toFixed(2)}°, ${east.toFixed(2)}°`;
    }

    onPageChange(event: Record<string, any>) {
        const newFirst = event['first'] ?? 0;
        const currentFirst = this.first();
        if (newFirst > currentFirst && this.nextLink()) {
            this.first.set(newFirst);
            this.loadPage(this.nextLink()!);
        } else if (newFirst < currentFirst && this.prevLink()) {
            this.first.set(newFirst);
            this.loadPage(this.prevLink()!);
        }
    }

    onItemNavigate(itemId: string) {
        this.router.navigate(['/collections', this.collectionId, 'items', itemId]);
    }

    onMapFeatureClick(featureId: string) {
        this.router.navigate(['/collections', this.collectionId, 'items', featureId]);
    }
}
