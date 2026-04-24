import { Component, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { MultiSelectModule } from 'primeng/multiselect';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { CheckboxModule } from 'primeng/checkbox';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { StacApiService } from '@/app/core/services/stac-api.service';
import { StacCollection, StacItem, StacItemCollection, StacLink, SearchFilterState, StacSearchRequest } from '@/app/core/models/stac.types';
import { ItemCardComponent } from '@/app/shared/components/item-card/item-card.component';
import { MapCanvasComponent } from '@/app/features/map/map-canvas.component';

@Component({
    selector: 'app-search',
    standalone: true,
    imports: [
        CommonModule, FormsModule, ButtonModule, InputTextModule, DatePickerModule,
        MultiSelectModule, MessageModule, SkeletonModule, CheckboxModule,
        IconFieldModule, InputIconModule, DividerModule, TooltipModule, TranslatePipe,
        ItemCardComponent, MapCanvasComponent
    ],
    styles: `
        .search-layout {
            display: grid;
            grid-template-columns: 380px 1fr;
            gap: 1rem;
            align-items: stretch;
        }
        .search-filters-panel {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }
        .search-map-panel {
            border-radius: 12px;
            overflow: hidden;
            min-height: 460px;
        }
        .filter-field {
            display: flex;
            flex-direction: column;
            gap: 0.35rem;
        }
        .filter-field label {
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--text-color-secondary);
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
            text-transform: uppercase;
            letter-spacing: 0.06em;
        }
        .filter-dates {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }
        :host ::ng-deep .filter-dates .p-datepicker {
            width: 100%;
        }
        @media (max-width: 991px) {
            .search-layout {
                grid-template-columns: 1fr;
            }
            .search-map-panel { min-height: 300px; }
        }
        .results-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
    `,
    template: `
        <!-- Header -->
        <div class="mb-4">
            <span class="font-mono text-xs uppercase tracking-widest" style="color: var(--color-cerrado-gold, #C4933F); letter-spacing: 0.12em;">
                {{ 'search.overline' | translate }}
            </span>
            <h1 class="text-3xl font-bold mt-1" style="font-family: var(--font-display, 'Exo 2'), system-ui, sans-serif; font-weight: 900; letter-spacing: -0.035em;">
                {{ 'search.title' | translate }}
            </h1>
        </div>

        <!-- Filtros + Mapa lado a lado -->
        <div class="search-layout mb-4">
            <!-- Painel de filtros -->
            <div class="card search-filters-panel">
                <div class="filter-field">
                    <label>{{ 'search.freeText' | translate }}</label>
                    <p-iconfield>
                        <p-inputicon class="pi pi-search" />
                        <input
                            type="text" pInputText
                            [(ngModel)]="filters.freeText"
                            [placeholder]="'search.placeholder' | translate"
                            class="w-full"
                            (keydown.enter)="onSearch()"
                        />
                    </p-iconfield>
                </div>

                <div class="filter-field">
                    <label>{{ 'search.temporal' | translate }}</label>
                    <div class="filter-dates">
                        <p-datepicker
                            [(ngModel)]="dateFrom"
                            [placeholder]="'search.dateFrom' | translate"
                            dateFormat="yy-mm-dd"
                            [showIcon]="true"
                            styleClass="w-full"
                        />
                        <p-datepicker
                            [(ngModel)]="dateTo"
                            [placeholder]="'search.dateTo' | translate"
                            dateFormat="yy-mm-dd"
                            [showIcon]="true"
                            styleClass="w-full"
                        />
                    </div>
                </div>

                <div class="filter-field">
                    <label>{{ 'search.collections' | translate }}</label>
                    <p-multiselect
                        [options]="collectionOptions()"
                        [(ngModel)]="selectedCollections"
                        optionLabel="label"
                        optionValue="value"
                        [placeholder]="'search.collections' | translate"
                        [filter]="true"
                        [maxSelectedLabels]="2"
                        styleClass="w-full"
                    />
                </div>

                <div class="filter-field">
                    <div class="flex items-center gap-2">
                        <p-checkbox [(ngModel)]="useBbox" [binary]="true" inputId="bbox-filter" />
                        <label for="bbox-filter" class="text-sm" style="cursor: pointer;">{{ 'search.spatialEnable' | translate }}</label>
                    </div>
                </div>

                @if (filters.bbox) {
                    <div class="flex items-center gap-2 p-3 rounded-lg" style="background: rgba(196, 147, 63, 0.1); border: 1px solid var(--color-cerrado-gold, #C4933F);">
                        <i class="pi pi-map-marker" style="color: var(--color-cerrado-gold, #C4933F);"></i>
                        <span class="font-mono text-xs" style="flex: 1; line-height: 1.4;">
                            {{ filters.bbox[0] | number:'1.2-2' }}°, {{ filters.bbox[1] | number:'1.2-2' }}°
                            <br>{{ filters.bbox[2] | number:'1.2-2' }}°, {{ filters.bbox[3] | number:'1.2-2' }}°
                        </span>
                        <p-button icon="pi pi-times" [rounded]="true" [text]="true" size="small" severity="danger" (onClick)="clearBbox()" pTooltip="Remover área" />
                    </div>
                }

                <div class="flex gap-2 mt-auto">
                    <p-button
                        [label]="'search.submit' | translate"
                        icon="pi pi-search"
                        (onClick)="onSearch()"
                        [loading]="loading()"
                        styleClass="flex-1"
                    />
                    <p-button
                        icon="pi pi-times"
                        severity="secondary"
                        [outlined]="true"
                        [rounded]="true"
                        (onClick)="onReset()"
                        [pTooltip]="'search.reset' | translate"
                        tooltipPosition="bottom"
                    />
                </div>
            </div>

            <!-- Mapa com ferramentas de desenho -->
            <div class="card p-0 search-map-panel">
                <app-map-canvas
                    [footprints]="footprintsGeoJson()"
                    [enableDraw]="useBbox"
                    (featureClick)="onFeatureClick($event)"
                    (bboxDrawn)="onBboxDrawn($event)"
                />
            </div>
        </div>

        <!-- Erro -->
        @if (error()) {
            <p-message severity="error" [text]="error()!" styleClass="w-full mb-4" />
        }

        <!-- Resultados -->
        @if (searched()) {
            <div class="results-header mb-4">
                <h2 class="text-xl font-bold" style="font-family: var(--font-display, 'Exo 2'), system-ui, sans-serif; font-weight: 700;">
                    {{ 'search.results' | translate }}
                    @if (totalMatched() !== null) {
                        <span class="text-sm font-normal text-muted-color ml-2">({{ totalMatched() }})</span>
                    }
                </h2>
            </div>

            @if (loading()) {
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    @for (i of [0,1,2,3,4,5,6,7]; track i) {
                        <div class="card p-0 overflow-hidden">
                            <p-skeleton width="100%" height="140px" borderRadius="0" />
                            <div class="p-3">
                                <p-skeleton width="80%" height="0.9rem" styleClass="mb-2" />
                                <p-skeleton width="50%" height="0.75rem" />
                            </div>
                        </div>
                    }
                </div>
            } @else if (results().length === 0) {
                <div class="card text-center py-10">
                    <i class="pi pi-search text-5xl text-muted-color mb-4" style="opacity: 0.4;"></i>
                    <p class="text-lg text-muted-color">{{ 'search.noResults' | translate }}</p>
                </div>
            } @else {
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    @for (item of results(); track item.id) {
                        <app-item-card [item]="item" (navigate)="onItemNavigate(item)" />
                    }
                </div>

                <div class="flex justify-center gap-3 mt-6">
                    @if (prevLink()) {
                        <p-button [label]="'pagination.prev' | translate" icon="pi pi-arrow-left" severity="secondary" [outlined]="true" (onClick)="loadPage(prevLink()!)" />
                    }
                    @if (nextLink()) {
                        <p-button [label]="'pagination.next' | translate" icon="pi pi-arrow-right" iconPos="right" severity="secondary" [outlined]="true" (onClick)="loadPage(nextLink()!)" />
                    }
                </div>
            }
        } @else {
            <!-- Estado inicial — orientação ao usuário -->
            <div class="card text-center py-10">
                <i class="pi pi-filter text-5xl mb-4" style="color: var(--color-cerrado-gold, #C4933F); opacity: 0.5;"></i>
                <p class="text-lg text-muted-color mb-2">Utilize os filtros acima para buscar dados geoespaciais.</p>
                <p class="text-sm text-muted-color">Você pode filtrar por texto, período, coleção ou área no mapa.</p>
            </div>
        }
    `
})
export class SearchComponent {
    private stacApi = inject(StacApiService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private destroyRef = inject(DestroyRef);

    filters: SearchFilterState = { bbox: null, dateFrom: null, dateTo: null, collections: [], freeText: '' };
    dateFrom: Date | null = null;
    dateTo: Date | null = null;
    selectedCollections: string[] = [];
    useBbox = false;

    results = signal<StacItem[]>([]);
    loading = signal(false);
    error = signal<string | null>(null);
    searched = signal(false);
    totalMatched = signal<number | null>(null);
    nextLink = signal<StacLink | null>(null);
    prevLink = signal<StacLink | null>(null);

    // Body do POST /search original — reutilizado em páginas subsequentes
    // para preservar filtros quando o servidor emite links rel=next/prev com
    // apenas o delta de paginação ({limit, skip}/{token}).
    private lastSearchRequest: StacSearchRequest | null = null;

    collectionOptions = signal<{ label: string; value: string }[]>([]);

    constructor() {
        this.stacApi.getCollections().pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: (data: { collections: StacCollection[]; links: StacLink[] }) => {
                this.collectionOptions.set(
                    data.collections.map((c: StacCollection) => ({ label: c.title || c.id, value: c.id }))
                );
            }
        });

        const q = this.route.snapshot.queryParamMap.get('q');
        if (q) {
            this.filters.freeText = q;
            setTimeout(() => this.onSearch());
        }
    }

    footprintsGeoJson(): Record<string, unknown> | null {
        const items = this.results();
        if (items.length === 0) return null;
        return {
            type: 'FeatureCollection',
            features: items.filter((i) => i.geometry).map((i) => ({
                type: 'Feature', id: i.id, geometry: i.geometry,
                properties: { id: i.id, title: i.properties.title || i.id }
            }))
        };
    }

    onSearch() {
        this.filters.collections = this.selectedCollections;
        this.filters.dateFrom = this.dateFrom ? this.dateFrom.toISOString() : null;
        this.filters.dateTo = this.dateTo ? this.dateTo.toISOString() : null;

        const request = this.stacApi.buildSearchRequest(this.filters);
        this.lastSearchRequest = request;
        this.loading.set(true);
        this.searched.set(true);
        this.error.set(null);

        this.stacApi.search(request).pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: (result: StacItemCollection) => this.processResults(result),
            error: () => {
                this.error.set('Erro ao executar a busca.');
                this.loading.set(false);
            }
        });
    }

    onReset() {
        this.filters = { bbox: null, dateFrom: null, dateTo: null, collections: [], freeText: '' };
        this.dateFrom = null;
        this.dateTo = null;
        this.selectedCollections = [];
        this.useBbox = false;
        this.results.set([]);
        this.searched.set(false);
        this.error.set(null);
    }

    loadPage(link: StacLink) {
        this.loading.set(true);
        this.stacApi.followLink<StacItemCollection>(link, this.lastSearchRequest ?? undefined).pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: (result: StacItemCollection) => this.processResults(result),
            error: () => { this.loading.set(false); }
        });
    }

    private processResults(result: StacItemCollection) {
        this.results.set(result.features);
        this.totalMatched.set(result.numberMatched ?? result.context?.matched ?? null);
        this.nextLink.set(result.links.find((l) => l.rel === 'next') ?? null);
        this.prevLink.set(result.links.find((l) => l.rel === 'prev' || l.rel === 'previous') ?? null);
        this.loading.set(false);
    }

    onFeatureClick(featureId: string) {
        const item = this.results().find((i) => i.id === featureId);
        if (item?.collection) {
            this.router.navigate(['/collections', item.collection, 'items', item.id]);
        }
    }

    onItemNavigate(item: StacItem) {
        if (item.collection) {
            this.router.navigate(['/collections', item.collection, 'items', item.id]);
        }
    }

    onBboxDrawn(bbox: [number, number, number, number]) {
        if (bbox) {
            this.filters.bbox = bbox;
        }
    }

    clearBbox() {
        this.filters.bbox = null;
    }
}
