export interface StacLink {
    rel: string;
    href: string;
    type?: string;
    title?: string;
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: unknown;
}

export interface StacProvider {
    name: string;
    description?: string;
    roles?: ('licensor' | 'producer' | 'processor' | 'host')[];
    url?: string;
}

export interface StacExtent {
    spatial: {
        bbox: number[][];
    };
    temporal: {
        interval: (string | null)[][];
    };
}

export interface StacAsset {
    href: string;
    title?: string;
    description?: string;
    type?: string;
    roles?: string[];
    'file:size'?: number;
    'proj:epsg'?: number;
    [key: string]: unknown;
}

export interface StacCatalog {
    type: 'Catalog';
    id: string;
    stac_version: string;
    title?: string;
    description: string;
    links: StacLink[];
    conformsTo?: string[];
}

export interface StacCollection {
    type: 'Collection';
    id: string;
    stac_version: string;
    stac_extensions?: string[];
    title?: string;
    description: string;
    keywords?: string[];
    license: string;
    providers?: StacProvider[];
    extent: StacExtent;
    summaries?: Record<string, unknown>;
    links: StacLink[];
    assets?: Record<string, StacAsset>;
}

export interface StacItemProperties {
    datetime: string | null;
    start_datetime?: string;
    end_datetime?: string;
    title?: string;
    description?: string;
    created?: string;
    updated?: string;
    'eo:cloud_cover'?: number;
    'eo:bands'?: Array<{ name: string; common_name?: string; description?: string; center_wavelength?: number; full_width_half_max?: number }>;
    'proj:epsg'?: number;
    'proj:geometry'?: unknown;
    'proj:bbox'?: number[];
    'proj:shape'?: number[];
    'proj:transform'?: number[];
    'sar:instrument_mode'?: string;
    'sar:frequency_band'?: string;
    'sar:polarizations'?: string[];
    'view:off_nadir'?: number;
    'view:sun_azimuth'?: number;
    'view:sun_elevation'?: number;
    [key: string]: unknown;
}

export interface StacItem {
    type: 'Feature';
    stac_version: string;
    stac_extensions?: string[];
    id: string;
    geometry: Record<string, unknown> | null;
    bbox?: number[];
    properties: StacItemProperties;
    links: StacLink[];
    assets: Record<string, StacAsset>;
    collection?: string;
}

export interface StacItemCollection {
    type: 'FeatureCollection';
    features: StacItem[];
    links: StacLink[];
    numberMatched?: number;
    numberReturned?: number;
    context?: {
        returned: number;
        matched: number;
        limit: number;
    };
}

export interface StacCollectionsResponse {
    collections: StacCollection[];
    links: StacLink[];
}

export interface StacConformanceResponse {
    conformsTo: string[];
}

/** Parâmetros para POST /search */
export interface StacSearchRequest {
    bbox?: [number, number, number, number];
    datetime?: string;
    collections?: string[];
    ids?: string[];
    q?: string[];
    limit?: number;
    sortby?: StacSortField[];
    filter?: StacCql2Filter;
    'filter-lang'?: 'cql2-json' | 'cql2-text';
    token?: string;
}

export interface StacSortField {
    field: string;
    direction: 'asc' | 'desc';
}

/** Filtro CQL2-JSON simplificado */
export interface StacCql2Filter {
    op: string;
    args: unknown[];
}

/** Estado de filtro local (UI → traduz para StacSearchRequest) */
export interface SearchFilterState {
    bbox: [number, number, number, number] | null;
    dateFrom: string | null;
    dateTo: string | null;
    collections: string[];
    freeText: string;
}
