import {
    Component,
    ElementRef,
    ViewChild,
    AfterViewInit,
    OnDestroy,
    DestroyRef,
    ChangeDetectionStrategy,
    inject,
    input,
    output,
    effect,
    signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import GeoJSON from 'ol/format/GeoJSON';
import Draw from 'ol/interaction/Draw';
import { createBox } from 'ol/interaction/Draw';
import { fromLonLat, transformExtent, toLonLat } from 'ol/proj';
import { Style, Fill, Stroke } from 'ol/style';
import { getTopLeft, getBottomRight } from 'ol/extent';
import Select from 'ol/interaction/Select';
import { pointerMove } from 'ol/events/condition';
import WebGLTileLayer from 'ol/layer/WebGLTile';
import GeoTIFF from 'ol/source/GeoTIFF';
import type { Feature } from 'ol';
import type { Geometry, Polygon } from 'ol/geom';
import type { CogStyleConfig } from './models/cog-style.types';
import { buildCogStyle } from './utils/cog-style.utils';

/** Estilo padrão de footprints — apenas borda, sem preenchimento */
const defaultStyle = new Style({
    stroke: new Stroke({ color: '#429B4D', width: 1 })
});

/** Estilo de hover — borda mais visível */
const hoverStyle = new Style({
    stroke: new Stroke({ color: '#429B4D', width: 2 })
});

/** Estilo de seleção — Cerrado Gold, borda apenas */
const selectStyle = new Style({
    stroke: new Stroke({ color: '#C4933F', width: 2 })
});

/** Estilo da área desenhada pelo usuário */
const drawStyle = new Style({
    fill: new Fill({ color: 'rgba(196, 147, 63, 0.15)' }),
    stroke: new Stroke({ color: '#C4933F', width: 2, lineDash: [8, 4] })
});

export type BasemapType = 'osm' | 'satellite';
export type DrawMode = 'none' | 'bbox' | 'polygon';

@Component({
    selector: 'app-map-canvas',
    standalone: true,
    imports: [CommonModule, ButtonModule, TooltipModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    styles: `
        :host {
            display: block;
            width: 100%;
            height: 100%;
        }
        .map-container {
            position: relative;
            width: 100%;
            height: 100%;
            min-height: 300px;
        }
        .map-target {
            position: absolute;
            inset: 0;
            border-radius: 8px;
            overflow: hidden;
        }
        .map-controls {
            position: absolute;
            bottom: 16px;
            right: 16px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            z-index: 10;
        }
        .draw-controls {
            position: absolute;
            top: 12px;
            right: 12px;
            display: flex;
            gap: 6px;
            z-index: 10;
        }
        .basemap-controls {
            position: absolute;
            bottom: 16px;
            left: 16px;
            z-index: 10;
            display: flex;
            gap: 4px;
        }
        .basemap-btn {
            width: 48px;
            height: 48px;
            border-radius: 8px;
            border: 2px solid transparent;
            cursor: pointer;
            overflow: hidden;
            background-size: cover;
            background-position: center;
            transition: border-color 150ms ease;
        }
        .basemap-btn:hover, .basemap-btn.active {
            border-color: var(--color-cerrado-green, #429B4D);
        }
        .basemap-osm {
            background-color: #e8e0d8;
            background-image: linear-gradient(135deg, #f0ebe4 25%, #d5cfc6 75%);
        }
        .basemap-satellite {
            background-color: #1B3A2A;
            background-image: linear-gradient(135deg, #1B3A2A 25%, #2A9D8F 75%);
        }
        .draw-hint {
            position: absolute;
            top: 12px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10;
            background: var(--color-cerrado-gold, #C4933F);
            color: white;
            padding: 0.4rem 1rem;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            pointer-events: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
    `,
    template: `
        <div class="map-container" role="application" [attr.aria-label]="drawModeActive() ? 'Desenhe a área de busca no mapa' : 'Mapa interativo'">
            <div #mapTarget class="map-target"></div>

            <!-- COG loading indicator -->
            @if (cogLoading()) {
                <div class="draw-hint" style="background: var(--color-tech-teal, #2A9D8F);">
                    <i class="pi pi-spin pi-spinner" style="margin-right: 0.4rem;"></i> Carregando raster...
                </div>
            }

            <!-- COG error indicator -->
            @if (cogError()) {
                <div class="draw-hint" style="background: #D32F2F;">
                    <i class="pi pi-exclamation-triangle" style="margin-right: 0.4rem;"></i> {{ cogError() }}
                </div>
            }

            <!-- Hint de desenho -->
            @if (drawModeActive()) {
                <div class="draw-hint">
                    @if (drawMode() === 'bbox') {
                        Clique e arraste para desenhar o retângulo de busca
                    } @else {
                        Clique nos vértices do polígono. Duplo-clique para finalizar.
                    }
                </div>
            }

            <!-- Controles de desenho (visíveis apenas quando drawMode habilitado) -->
            @if (enableDraw()) {
                <div class="draw-controls" role="group" aria-label="Ferramentas de desenho">
                    <p-button
                        icon="pi pi-stop"
                        [rounded]="true"
                        size="small"
                        [severity]="drawMode() === 'bbox' ? 'warn' : 'secondary'"
                        [outlined]="drawMode() !== 'bbox'"
                        (onClick)="toggleDrawMode('bbox')"
                        pTooltip="Desenhar retângulo"
                        tooltipPosition="left"
                        aria-label="Desenhar retângulo de busca"
                    />
                    <p-button
                        icon="pi pi-pencil"
                        [rounded]="true"
                        size="small"
                        [severity]="drawMode() === 'polygon' ? 'warn' : 'secondary'"
                        [outlined]="drawMode() !== 'polygon'"
                        (onClick)="toggleDrawMode('polygon')"
                        pTooltip="Desenhar polígono"
                        tooltipPosition="left"
                        aria-label="Desenhar polígono de busca"
                    />
                    @if (hasDrawnArea()) {
                        <p-button
                            icon="pi pi-trash"
                            [rounded]="true"
                            size="small"
                            severity="danger"
                            [outlined]="true"
                            (onClick)="clearDrawnArea()"
                            pTooltip="Limpar área desenhada"
                            tooltipPosition="left"
                            aria-label="Limpar área desenhada"
                        />
                    }
                </div>
            }

            <!-- Controles de zoom -->
            <div class="map-controls" role="group" aria-label="Controles do mapa">
                <p-button icon="pi pi-plus" [rounded]="true" size="small" severity="secondary" (onClick)="zoomIn()" pTooltip="Ampliar" tooltipPosition="left" aria-label="Ampliar mapa" />
                <p-button icon="pi pi-minus" [rounded]="true" size="small" severity="secondary" (onClick)="zoomOut()" pTooltip="Reduzir" tooltipPosition="left" aria-label="Reduzir mapa" />
            </div>

            <!-- Basemap switcher -->
            <div class="basemap-controls" role="group" aria-label="Seleção de mapa base">
                <button class="basemap-btn basemap-osm" [class.active]="activeBasemap() === 'osm'" (click)="setBasemap('osm')" [attr.aria-pressed]="activeBasemap() === 'osm'" aria-label="OpenStreetMap"></button>
                <button class="basemap-btn basemap-satellite" [class.active]="activeBasemap() === 'satellite'" (click)="setBasemap('satellite')" [attr.aria-pressed]="activeBasemap() === 'satellite'" aria-label="Satélite"></button>
            </div>
        </div>
    `
})
export class MapCanvasComponent implements AfterViewInit, OnDestroy {
    @ViewChild('mapTarget') mapTarget!: ElementRef<HTMLDivElement>;

    private destroyRef = inject(DestroyRef);

    // Inputs existentes
    center = input<[number, number]>([-49.25, -15.94]);
    zoom = input<number>(5);
    footprints = input<Record<string, unknown> | null>(null);
    fitBbox = input<number[] | null>(null);

    /** Habilitar ferramentas de desenho (bbox/polygon) */
    enableDraw = input<boolean>(false);
    /** URL de um COG para renderizar como raster overlay */
    cogUrl = input<string | null>(null);
    /** Configuração de estilo para a camada COG */
    cogStyle = input<CogStyleConfig | null>(null);
    /** Projeção do COG (ex: 'EPSG:4326') — auto-detectada dos GeoKeys se não fornecida */
    cogProjection = input<string | null>(null);

    // Outputs existentes
    featureClick = output<string>();
    featureHover = output<string | null>();

    /** Emitido quando o usuário finaliza o desenho de uma área. Bbox em [west, south, east, north] */
    bboxDrawn = output<[number, number, number, number]>();

    // Signals
    activeBasemap = signal<BasemapType>('osm');
    drawMode = signal<DrawMode>('none');
    drawModeActive = signal(false);
    hasDrawnArea = signal(false);

    // OL objects
    private map: Map | null = null;
    private osmLayer!: TileLayer;
    private satelliteLayer!: TileLayer;
    private footprintsSource!: VectorSource;
    private footprintsLayer!: VectorLayer;
    private drawSource!: VectorSource;
    private drawLayer!: VectorLayer;
    private drawInteraction: Draw | null = null;
    private hoverInteraction: Select | null = null;
    private selectInteraction: Select | null = null;
    private cogLayer: WebGLTileLayer | null = null;
    private geoJsonFormat = new GeoJSON();
    private mapInitialized = false;
    cogLoading = signal(false);
    cogError = signal<string | null>(null);

    constructor() {
        effect(() => {
            const fc = this.footprints();
            if (this.mapInitialized) {
                this.updateFootprints(fc);
            }
        });

        effect(() => {
            const bbox = this.fitBbox();
            if (bbox && bbox.length === 4 && this.mapInitialized) {
                this.fitToBbox(bbox);
            }
        });

        // Effect para criação da camada COG — aguarda URL e estilo antes de criar
        effect(() => {
            const url = this.cogUrl();
            const style = this.cogStyle();
            if (!url || !style || !this.mapInitialized) return;

            if (this.cogLayer) {
                // Camada já existe — apenas atualizar estilo (sem recriar)
                this.cogLayer.setStyle(buildCogStyle(style));
                this.cogLayer.setOpacity(style.opacity);
            } else {
                // Criar camada pela primeira vez
                this.updateCogLayer(url);
            }
        });

        this.destroyRef.onDestroy(() => this.cleanup());
    }

    ngAfterViewInit() {
        this.initializeMap();
    }

    ngOnDestroy() {
        this.cleanup();
    }

    private cleanup() {
        this.removeCogLayer();
        this.removeDrawInteraction();
        if (this.hoverInteraction) {
            this.map?.removeInteraction(this.hoverInteraction);
            this.hoverInteraction.dispose();
            this.hoverInteraction = null;
        }
        if (this.selectInteraction) {
            this.map?.removeInteraction(this.selectInteraction);
            this.selectInteraction.dispose();
            this.selectInteraction = null;
        }
        if (this.footprintsSource) {
            this.footprintsSource.clear();
        }
        if (this.drawSource) {
            this.drawSource.clear();
        }
        if (this.map) {
            this.map.setTarget(undefined);
            this.map.dispose();
            this.map = null;
        }
        this.mapInitialized = false;
    }

    private initializeMap() {
        this.osmLayer = new TileLayer({
            source: new XYZ({
                url: `https://api.mapbox.com/styles/v1/mapbox/light-v10/tiles/{z}/{x}/{y}?access_token=${(window as any).__MAPBOX_TOKEN__ || ''}`,
                wrapX: false,
                tileSize: 512,
                attributions: '&copy; <a href="https://www.mapbox.com/">Mapbox</a>'
            }),
            visible: true
        });

        this.satelliteLayer = new TileLayer({
            source: new XYZ({
                url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                maxZoom: 19,
                attributions: 'Tiles &copy; Esri'
            }),
            visible: false
        });

        this.footprintsSource = new VectorSource();
        this.footprintsLayer = new VectorLayer({
            source: this.footprintsSource,
            style: defaultStyle,
            zIndex: 10
        });

        this.drawSource = new VectorSource();
        this.drawLayer = new VectorLayer({
            source: this.drawSource,
            style: drawStyle,
            zIndex: 20
        });

        this.map = new Map({
            target: this.mapTarget.nativeElement,
            layers: [this.osmLayer, this.satelliteLayer, this.footprintsLayer, this.drawLayer],
            view: new View({
                center: fromLonLat(this.center()),
                zoom: this.zoom()
            }),
            controls: []
        });

        this.setupInteractions();
        this.mapInitialized = true;

        const initialFootprints = this.footprints();
        if (initialFootprints) {
            this.updateFootprints(initialFootprints);
        }

        const initialBbox = this.fitBbox();
        if (initialBbox && initialBbox.length === 4) {
            this.map.once('rendercomplete', () => {
                this.fitToBbox(initialBbox);
            });
        }

        // Aplicar COG se já disponível (effect pode ter rodado antes do mapa init)
        const initialCog = this.cogUrl();
        const initialStyle = this.cogStyle();
        if (initialCog && initialStyle) {
            this.updateCogLayer(initialCog);
        }
    }

    private setupInteractions() {
        if (!this.map) return;

        this.hoverInteraction = new Select({
            condition: pointerMove,
            layers: [this.footprintsLayer],
            style: hoverStyle
        });

        this.hoverInteraction.on('select', (e) => {
            const feature = e.selected[0] as Feature<Geometry> | undefined;
            this.featureHover.emit(feature ? (feature.getId() as string) ?? null : null);
        });

        this.selectInteraction = new Select({
            layers: [this.footprintsLayer],
            style: selectStyle
        });

        this.selectInteraction.on('select', (e) => {
            const feature = e.selected[0] as Feature<Geometry> | undefined;
            if (feature) {
                const id = feature.getId() as string;
                if (id) {
                    this.featureClick.emit(id);
                }
            }
        });

        this.map.addInteraction(this.hoverInteraction);
        this.map.addInteraction(this.selectInteraction);
    }

    // --- Ferramentas de desenho ---

    toggleDrawMode(mode: DrawMode) {
        if (this.drawMode() === mode) {
            // Desativar
            this.removeDrawInteraction();
            this.drawMode.set('none');
            this.drawModeActive.set(false);
        } else {
            // Ativar novo modo
            this.removeDrawInteraction();
            this.drawSource.clear();
            this.hasDrawnArea.set(false);
            this.drawMode.set(mode);
            this.drawModeActive.set(true);
            this.addDrawInteraction(mode);
        }
    }

    private addDrawInteraction(mode: DrawMode) {
        if (!this.map) return;

        const type = mode === 'bbox' ? 'Circle' : 'Polygon';

        this.drawInteraction = new Draw({
            source: this.drawSource,
            type: type as any,
            ...(mode === 'bbox' ? { geometryFunction: createBox() } : {}),
            style: drawStyle
        });

        this.drawInteraction.on('drawend', (e) => {
            const geometry = e.feature.getGeometry() as Polygon;
            if (!geometry) return;

            // Extrair bbox da geometria desenhada
            const extent = geometry.getExtent();
            const topLeft = toLonLat(getTopLeft(extent));
            const bottomRight = toLonLat(getBottomRight(extent));

            const bbox: [number, number, number, number] = [
                Math.min(topLeft[0], bottomRight[0]),   // west
                Math.min(topLeft[1], bottomRight[1]),   // south
                Math.max(topLeft[0], bottomRight[0]),   // east
                Math.max(topLeft[1], bottomRight[1])    // north
            ];

            this.hasDrawnArea.set(true);
            this.bboxDrawn.emit(bbox);

            // Desativar interação de desenho após finalizar
            setTimeout(() => {
                this.removeDrawInteraction();
                this.drawModeActive.set(false);
                this.drawMode.set('none');
            }, 100);
        });

        // Desabilitar hover/select durante desenho
        if (this.hoverInteraction) this.hoverInteraction.setActive(false);
        if (this.selectInteraction) this.selectInteraction.setActive(false);

        this.map.addInteraction(this.drawInteraction);
    }

    private removeDrawInteraction() {
        if (this.drawInteraction) {
            this.map?.removeInteraction(this.drawInteraction);
            this.drawInteraction.dispose();
            this.drawInteraction = null;
        }
        // Reabilitar hover/select
        if (this.hoverInteraction) this.hoverInteraction.setActive(true);
        if (this.selectInteraction) this.selectInteraction.setActive(true);
    }

    clearDrawnArea() {
        this.drawSource.clear();
        this.hasDrawnArea.set(false);
        this.removeDrawInteraction();
        this.drawMode.set('none');
        this.drawModeActive.set(false);
        this.bboxDrawn.emit(null as any);
    }

    // --- COG Rendering ---

    private updateCogLayer(url: string | null) {
        this.removeCogLayer();
        this.cogError.set(null);
        if (!url || !this.map) return;

        this.cogLoading.set(true);
        console.log('[MapCanvas] Carregando COG:', url);

        // Projeção: usar metadado STAC se disponível, senão deixar OL auto-detectar dos GeoKeys
        const projection = this.cogProjection() ?? undefined;

        const geoTiffOptions: Record<string, unknown> = {
            sources: [{ url }],
            normalize: false,
            convertToRGB: false,
            interpolate: false,
            wrapX: true
        };
        if (projection) {
            geoTiffOptions['projection'] = projection;
        }
        const source = new GeoTIFF(geoTiffOptions as any);

        const config = this.cogStyle();
        const finalStyle = config ? buildCogStyle(config) : { color: ['band', 1] };
        console.log('[MapCanvas] Estilo aplicado:', JSON.stringify(finalStyle));

        this.cogLayer = new WebGLTileLayer({
            source,
            style: finalStyle as any,
            zIndex: 5,
            opacity: config?.opacity ?? 1
        });

        this.map.addLayer(this.cogLayer);

        source.getView().then((viewConfig: any) => {
            console.log('[MapCanvas] COG view config:', JSON.stringify(viewConfig));
            this.cogLoading.set(false);

            if (viewConfig.extent && this.map) {
                // Usar a projeção informada pelo source, com fallback para EPSG:4326
                const sourceProj = viewConfig.projection ?? projection ?? 'EPSG:4326';
                const extent3857 = transformExtent(
                    viewConfig.extent, sourceProj, 'EPSG:3857'
                );
                console.log('[MapCanvas] Extent reprojetado (3857):', extent3857);
                this.map.getView().fit(extent3857, {
                    padding: [40, 40, 40, 40],
                    duration: 600,
                    maxZoom: 12
                });
            }
        }).catch((err: any) => {
            this.cogLoading.set(false);
            const msg = err?.message ?? 'Erro desconhecido ao carregar o raster';
            this.cogError.set(`Falha ao carregar COG: ${msg}`);
            console.error('[MapCanvas] Erro ao carregar COG:', url, err);
        });
    }

    private removeCogLayer() {
        if (this.cogLayer) {
            this.map?.removeLayer(this.cogLayer);
            this.cogLayer.dispose();
            this.cogLayer = null;
        }
    }

    // --- Footprints ---

    private updateFootprints(fc: Record<string, unknown> | null) {
        if (!this.footprintsSource) return;
        this.footprintsSource.clear();

        if (!fc || !fc['type']) return;

        try {
            const features = this.geoJsonFormat.readFeatures(fc, {
                featureProjection: 'EPSG:3857'
            });
            this.footprintsSource.addFeatures(features);
        } catch (err) {
            console.warn('[MapCanvas] GeoJSON inválido:', err);
        }
    }

    // --- Controles ---

    zoomIn() {
        const view = this.map?.getView();
        if (view) {
            view.animate({ zoom: (view.getZoom() ?? 5) + 1, duration: 250 });
        }
    }

    zoomOut() {
        const view = this.map?.getView();
        if (view) {
            view.animate({ zoom: (view.getZoom() ?? 5) - 1, duration: 250 });
        }
    }

    setBasemap(type: BasemapType) {
        this.activeBasemap.set(type);
        this.osmLayer.setVisible(type === 'osm');
        this.satelliteLayer.setVisible(type === 'satellite');
    }

    flyTo(center: [number, number], zoom?: number) {
        this.map?.getView().animate({
            center: fromLonLat(center),
            zoom: zoom ?? this.map.getView().getZoom(),
            duration: 800
        });
    }

    fitToBbox(bbox: number[]) {
        if (!this.map || bbox.length < 4) return;
        const extent = transformExtent(bbox, 'EPSG:4326', 'EPSG:3857');
        this.map.getView().fit(extent, {
            padding: [40, 40, 40, 40],
            duration: 600,
            maxZoom: 16
        });
    }

    updateSize() {
        this.map?.updateSize();
    }
}
