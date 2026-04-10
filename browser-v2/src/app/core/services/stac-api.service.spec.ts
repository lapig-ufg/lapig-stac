import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { StacApiService } from './stac-api.service';
import { StacCollectionsResponse, StacConformanceResponse, StacItem, StacItemCollection, SearchFilterState } from '@/app/core/models/stac.types';

describe('StacApiService', () => {
    let service: StacApiService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                StacApiService
            ]
        });
        service = TestBed.inject(StacApiService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should fetch collections', () => {
        const mockResponse: StacCollectionsResponse = {
            collections: [{ type: 'Collection', id: 'test', stac_version: '1.0.0', description: 'Test', license: 'MIT', extent: { spatial: { bbox: [[-50, -16, -48, -14]] }, temporal: { interval: [['2020-01-01', '2024-12-31']] } }, links: [] }],
            links: []
        };

        service.getCollections().subscribe((data) => {
            expect(data.collections.length).toBe(1);
            expect(data.collections[0].id).toBe('test');
        });

        const req = httpMock.expectOne('http://localhost:8000/collections');
        expect(req.request.method).toBe('GET');
        req.flush(mockResponse);
    });

    it('should fetch a single collection', () => {
        service.getCollection('test-col').subscribe((col) => {
            expect(col.id).toBe('test-col');
        });

        const req = httpMock.expectOne('http://localhost:8000/collections/test-col');
        expect(req.request.method).toBe('GET');
        req.flush({ type: 'Collection', id: 'test-col', stac_version: '1.0.0', description: '', license: 'MIT', extent: { spatial: { bbox: [] }, temporal: { interval: [] } }, links: [] });
    });

    it('should fetch items with limit', () => {
        service.getItems('col1', 10).subscribe((data) => {
            expect(data.features.length).toBe(0);
        });

        const req = httpMock.expectOne('http://localhost:8000/collections/col1/items?limit=10');
        expect(req.request.method).toBe('GET');
        req.flush({ type: 'FeatureCollection', features: [], links: [] });
    });

    it('should fetch a single item', () => {
        service.getItem('col1', 'item1').subscribe((item) => {
            expect(item.id).toBe('item1');
        });

        const req = httpMock.expectOne('http://localhost:8000/collections/col1/items/item1');
        expect(req.request.method).toBe('GET');
        req.flush({ type: 'Feature', stac_version: '1.0.0', id: 'item1', geometry: null, properties: { datetime: null }, links: [], assets: {} });
    });

    it('should POST search request', () => {
        service.search({ collections: ['col1'], limit: 5 }).subscribe((data) => {
            expect(data.features.length).toBe(1);
        });

        const req = httpMock.expectOne('http://localhost:8000/search');
        expect(req.request.method).toBe('POST');
        expect(req.request.body.collections).toEqual(['col1']);
        expect(req.request.body.limit).toBe(5);
        req.flush({ type: 'FeatureCollection', features: [{ type: 'Feature', stac_version: '1.0.0', id: 'r1', geometry: null, properties: { datetime: null }, links: [], assets: {} }], links: [] });
    });

    it('should build search request from filter state', () => {
        const filters: SearchFilterState = {
            bbox: [-50, -16, -48, -14],
            dateFrom: '2020-01-01T00:00:00Z',
            dateTo: '2024-12-31T23:59:59Z',
            collections: ['col1', 'col2'],
            freeText: 'sentinel ndvi'
        };

        const request = service.buildSearchRequest(filters, 25);

        expect(request.bbox).toEqual([-50, -16, -48, -14]);
        expect(request.datetime).toBe('2020-01-01T00:00:00Z/2024-12-31T23:59:59Z');
        expect(request.collections).toEqual(['col1', 'col2']);
        expect(request.q).toEqual(['sentinel', 'ndvi']);
        expect(request.limit).toBe(25);
    });

    it('should build search request with partial filters', () => {
        const filters: SearchFilterState = {
            bbox: null,
            dateFrom: '2020-01-01T00:00:00Z',
            dateTo: null,
            collections: [],
            freeText: ''
        };

        const request = service.buildSearchRequest(filters);

        expect(request.bbox).toBeUndefined();
        expect(request.datetime).toBe('2020-01-01T00:00:00Z/..');
        expect(request.collections).toBeUndefined();
        expect(request.q).toBeUndefined();
        expect(request.limit).toBe(20);
    });

    it('should cache collections with shareReplay', () => {
        const mockResponse: StacCollectionsResponse = { collections: [], links: [] };

        // Primeira chamada
        service.getCollections().subscribe();
        httpMock.expectOne('http://localhost:8000/collections').flush(mockResponse);

        // Segunda chamada — deve usar cache, sem nova requisição HTTP
        service.getCollections().subscribe((data) => {
            expect(data.collections.length).toBe(0);
        });

        httpMock.expectNone('http://localhost:8000/collections');
    });

    it('should detect filter conformance', () => {
        service.getConformance().subscribe();

        const req = httpMock.expectOne('http://localhost:8000/conformance');
        req.flush({ conformsTo: ['https://api.stacspec.org/v1.0.0/item-search#filter', 'https://api.stacspec.org/v1.0.0/item-search#free-text'] });

        expect(service.supportsFilter()).toBeTrue();
        expect(service.supportsFreeText()).toBeTrue();
        expect(service.supportsSort()).toBeFalse();
    });
});
