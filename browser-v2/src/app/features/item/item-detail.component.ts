import { Component, inject, signal, computed, effect, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { parseSldToClassification } from '@/app/features/map/utils/sld-parser.utils';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TabsModule } from 'primeng/tabs';
import { TooltipModule } from 'primeng/tooltip';
import { SplitterModule } from 'primeng/splitter';
import { StacApiService } from '@/app/core/services/stac-api.service';
import { StacItem, StacAsset, StacCollection } from '@/app/core/models/stac.types';
import { MapCanvasComponent } from '@/app/features/map/map-canvas.component';
import { CogControlsComponent } from '@/app/features/map/components/cog-controls.component';
import { MetadataPanelComponent } from '@/app/shared/components/metadata-panel/metadata-panel.component';
import { AssetListComponent } from './components/asset-list.component';
import { JsonViewerComponent } from '@/app/shared/components/json-viewer/json-viewer.component';
import { ApiSnippetComponent } from '@/app/shared/components/api-snippet/api-snippet.component';
import { TranslatePipe } from '@ngx-translate/core';
import { environment } from '@/app/core/config/environment';
import type { BandInfo, CogStyleConfig, ClassificationEntry } from '@/app/features/map/models/cog-style.types';
import { createDefaultCogStyle } from '@/app/features/map/models/cog-style.types';

@Component({
    selector: 'app-item-detail',
    standalone: true,
    imports: [
        CommonModule, RouterModule, ButtonModule, MessageModule, SkeletonModule,
        TabsModule, TooltipModule, SplitterModule, TranslatePipe, MapCanvasComponent,
        CogControlsComponent, MetadataPanelComponent, AssetListComponent,
        JsonViewerComponent, ApiSnippetComponent
    ],
    styles: `
        :host ::ng-deep .item-splitter .p-splitterpanel {
            overflow: auto;
        }
        .map-panel-inner {
            height: 100%;
            min-height: 500px;
        }
        .metadata-scroll {
            max-height: 500px;
            overflow-y: auto;
            padding-right: 0.5rem;
        }
        @media (max-width: 1023px) {
            .map-panel-inner {
                min-height: 300px;
            }
        }
    `,
    template: `
        <!-- Loading -->
        @if (loading()) {
            <div class="card">
                <div class="flex items-center gap-3 mb-6">
                    <p-skeleton width="32px" height="32px" shape="circle" />
                    <div>
                        <p-skeleton width="80px" height="0.6rem" styleClass="mb-2" />
                        <p-skeleton width="250px" height="1.5rem" />
                    </div>
                </div>
                <p-skeleton width="100%" height="400px" borderRadius="12px" />
            </div>
        }

        <!-- Error -->
        @if (error()) {
            <p-message severity="error" [text]="error()!" styleClass="w-full mb-4" />
        }

        <!-- Item loaded -->
        @if (item(); as item) {
            <!-- Header -->
            <div class="card mb-4">
                <div class="flex items-center gap-3">
                    <p-button
                        icon="pi pi-arrow-left"
                        [text]="true"
                        [rounded]="true"
                        [routerLink]="['/collections', collectionId]"
                        [pTooltip]="'nav.backToCollection' | translate"
                    />
                    <div>
                        <span class="font-mono text-xs uppercase tracking-widest" style="color: var(--color-cerrado-gold, #C4933F); letter-spacing: 0.12em;">
                            {{ collectionId }}
                        </span>
                        <h1 class="text-2xl font-bold" style="font-family: var(--font-display, 'Exo 2'), system-ui, sans-serif; font-weight: 800; letter-spacing: -0.03em;">
                            {{ item.properties.title || item.id }}
                        </h1>
                    </div>
                </div>
            </div>

            <!-- Split: Metadados + Estilos | Mapa com COG -->
            <p-splitter [panelSizes]="[35, 65]" [minSizes]="[25, 40]" styleClass="mb-4 item-splitter" [style]="{ 'min-height': '520px' }">
                <ng-template #panel>
                    <div class="card h-full overflow-auto p-4">
                        <div class="metadata-scroll">
                            <app-metadata-panel
                                [properties]="item.properties"
                                [extensions]="item.stac_extensions || []"
                            />
                        </div>

                    </div>
                </ng-template>
                <ng-template #panel>
                    <div class="map-panel-inner" style="position: relative;">
                        <app-map-canvas
                            [footprints]="itemGeoJson()"
                            [fitBbox]="itemBbox()"
                            [cogUrl]="cogAssetUrl()"
                            [cogStyle]="cogStyleConfig()"
                            [cogProjection]="cogProjection()"
                        />
                        @if (cogAssetUrl() && cogStyleConfig()) {
                            <app-cog-controls
                                [bands]="cogBands()"
                                [config]="cogStyleConfig()!"
                                (configChange)="cogStyleConfig.set($event)"
                            />
                        }
                    </div>
                </ng-template>
            </p-splitter>

            <!-- Tabs: Assets | API | JSON -->
            <div class="card">
                <p-tabs value="assets">
                    <p-tablist>
                        <p-tab value="assets">
                            <i class="pi pi-box mr-2"></i> {{ 'item.tabs.assets' | translate }} ({{ assetCount() }})
                        </p-tab>
                        <p-tab value="api">
                            <i class="pi pi-server mr-2"></i> {{ 'item.tabs.api' | translate }}
                        </p-tab>
                        <p-tab value="json">
                            <i class="pi pi-code mr-2"></i> {{ 'item.tabs.json' | translate }}
                        </p-tab>
                    </p-tablist>
                    <p-tabpanels>
                        <p-tabpanel value="assets">
                            <app-asset-list [assets]="item.assets" />
                        </p-tabpanel>
                        <p-tabpanel value="api">
                            <app-api-snippet
                                [stacUrl]="stacItemUrl()"
                                [collectionId]="collectionId"
                                [itemId]="itemId"
                                [cogUrl]="cogAssetUrl()"
                            />
                        </p-tabpanel>
                        <p-tabpanel value="json">
                            <app-json-viewer [data]="item" />
                        </p-tabpanel>
                    </p-tabpanels>
                </p-tabs>
            </div>
        }
    `
})
export class ItemDetailComponent {
    private stacApi = inject(StacApiService);
    private route = inject(ActivatedRoute);
    private destroyRef = inject(DestroyRef);
    private http = inject(HttpClient);

    /** Guard: evita que o SLD seja baixado/aplicado mais de uma vez por item. */
    private sldAutoApplied = false;

    item = signal<StacItem | null>(null);
    loading = signal(true);
    error = signal<string | null>(null);
    collection = signal<StacCollection | null>(null);

    collectionAssets = computed(() => this.collection()?.assets ?? null);

    collectionId: string;
    itemId: string;

    itemGeoJson = computed<Record<string, unknown> | null>(() => {
        const item = this.item();
        if (!item?.geometry) return null;
        return {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', id: item.id, geometry: item.geometry, properties: { id: item.id } }]
        };
    });

    itemBbox = computed<number[] | null>(() => this.item()?.bbox ?? null);

    assetCount = computed(() => Object.keys(this.item()?.assets ?? {}).length);

    stacItemUrl = computed(() => `${environment.stacApiUrl}/collections/${this.collectionId}/items/${this.itemId}`);

    cogAssetUrl = computed<string | null>(() => {
        const item = this.item();
        if (!item) return null;
        for (const asset of Object.values(item.assets)) {
            if (asset.type && asset.type.toLowerCase().includes('image/tiff')) {
                return this.proxyCogUrl(asset.href);
            }
        }
        return null;
    });

    /** Bandas do item derivadas de eo:bands ou raster:bands */
    cogBands = computed<BandInfo[]>(() => {
        const item = this.item();
        if (!item) return [{ index: 1, name: 'Band 1' }];

        const eoBands = item.properties['eo:bands'];
        if (eoBands?.length) {
            return eoBands.map((b, i) => ({
                index: i + 1,
                name: b.name,
                commonName: b.common_name
            }));
        }

        const rasterBands = item.properties['raster:bands'] as unknown[] | undefined;
        if (rasterBands?.length) {
            return rasterBands.map((_, i) => ({
                index: i + 1,
                name: `Band ${i + 1}`
            }));
        }

        return [{ index: 1, name: 'Band 1' }];
    });

    /** Classes de classificação derivadas de summaries['classification:classes'] da coleção */
    classificationClasses = computed<ClassificationEntry[] | null>(() => {
        const col = this.collection();
        if (!col?.summaries) return null;
        const classes = col.summaries['classification:classes'] as Array<{ value: number; label: string; color: string }> | undefined;
        if (!classes?.length) return null;
        return classes.map(c => ({ value: c.value, label: c.label, color: c.color }));
    });

    /** Projeção do item derivada de proj:epsg */
    cogProjection = computed<string | null>(() => {
        const epsg = this.item()?.properties['proj:epsg'];
        return epsg ? `EPSG:${epsg}` : null;
    });

    /** Configuração reativa de estilo COG (controlada pelo usuário via CogControlsComponent) */
    cogStyleConfig = signal<CogStyleConfig | null>(null);

    /** Base URL da coleção para resolver hrefs relativos dos estilos */
    collectionBaseUrl = computed(() => `${environment.stacApiUrl}/collections/${this.collectionId}`);

    constructor() {
        this.collectionId = this.route.snapshot.paramMap.get('collectionId') ?? '';
        this.itemId = this.route.snapshot.paramMap.get('itemId') ?? '';
        if (!this.collectionId || !this.itemId) {
            this.error.set('Identificadores de coleção ou item não informados.');
            this.loading.set(false);
            return;
        }
        this.loadItem();
        this.loadCollectionStyles();

        // Inicializa cogStyleConfig quando o item E a coleção carregam (evita race condition)
        effect(() => {
            const url = this.cogAssetUrl();
            const col = this.collection();
            const bands = this.cogBands();
            // Aguardar item e coleção antes de criar o estilo
            if (!url || !col) return;
            if (this.cogStyleConfig()) return; // já configurado

            const classes = this.classificationClasses();
            const config = createDefaultCogStyle(bands.length, classes ?? undefined);

            // Para rasters contínuos (sem classificação), ler min/max de raster:bands
            if (!classes) {
                const item = this.item();
                const rasterBands = item?.properties['raster:bands'] as Array<{ statistics?: { minimum?: number; maximum?: number } }> | undefined;
                if (rasterBands?.[0]?.statistics) {
                    const stats = rasterBands[0].statistics;
                    if (stats.minimum != null) config.min = stats.minimum;
                    if (stats.maximum != null) config.max = stats.maximum;
                }
            }
            this.cogStyleConfig.set(config);
        });

        // Auto-aplicação do estilo SLD:
        //
        // Mesmo com classification:classes na Collection (que o effect acima
        // já aplicou), procuramos o primeiro asset com role "style" e media
        // type SLD e o baixamos para sobrescrever as classes com as do SLD.
        // Isso garante que a cartografia oficial do serviço (OGC SLD) vire
        // o default do mapa — sem o usuário clicar em "Aplicar ao mapa".
        effect(() => {
            const item = this.item();
            const bands = this.cogBands();
            if (!item || this.sldAutoApplied) return;
            const sldAsset = Object.values(item.assets ?? {}).find(
                (a) => a.roles?.includes('style') && (a.type ?? '').includes('sld')
            );
            if (!sldAsset?.href) return;

            this.sldAutoApplied = true;
            this.http.get(sldAsset.href, { responseType: 'text' }).pipe(
                takeUntilDestroyed(this.destroyRef)
            ).subscribe({
                next: (xml) => {
                    const classes = parseSldToClassification(xml);
                    if (!classes.length) return;
                    this.cogStyleConfig.set(createDefaultCogStyle(bands.length, classes));
                },
                error: (err) => console.warn('[ItemDetail] falha ao baixar SLD:', err)
            });
        });
    }

    /**
     * Reescreve URL do S3 para passar pelo proxy CORS do nginx.
     * https://s3.lapig.iesa.ufg.br/path → /cog-proxy/path
     */
    private proxyCogUrl(href: string): string {
        const s3Host = 'https://s3.lapig.iesa.ufg.br/';
        if (href.startsWith(s3Host)) {
            return '/cog-proxy/' + href.substring(s3Host.length);
        }
        return href;
    }

    private loadItem() {
        this.stacApi.getItem(this.collectionId, this.itemId).pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: (item) => {
                this.item.set(item);
                this.loading.set(false);
            },
            error: () => {
                this.error.set(`Erro ao carregar o item "${this.itemId}" da coleção "${this.collectionId}".`);
                this.loading.set(false);
            }
        });
    }

    private loadCollectionStyles() {
        this.stacApi.getCollection(this.collectionId).pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: (col: StacCollection) => {
                this.collection.set(col);
            }
        });
    }
}
