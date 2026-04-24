import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, shareReplay, tap, catchError, of } from 'rxjs';
import { environment } from '@/app/core/config/environment';
import {
    StacCatalog,
    StacCollection,
    StacCollectionsResponse,
    StacConformanceResponse,
    StacItem,
    StacItemCollection,
    StacLink,
    StacSearchRequest,
    SearchFilterState
} from '@/app/core/models/stac.types';

@Injectable({ providedIn: 'root' })
export class StacApiService {
    private http = inject(HttpClient);
    private baseUrl = signal<string>(environment.stacApiUrl);

    private collectionsCache$: Observable<StacCollectionsResponse> | null = null;
    private conformanceCache$: Observable<StacConformanceResponse> | null = null;

    private conformanceClasses = signal<string[]>([]);

    supportsFilter = computed(() => this.conformanceClasses().some((c) => c.includes('filter')));
    supportsFreeText = computed(() => this.conformanceClasses().some((c) => c.includes('free-text')));
    supportsSort = computed(() => this.conformanceClasses().some((c) => c.includes('sort')));

    getLandingPage(): Observable<StacCatalog> {
        return this.http.get<StacCatalog>(this.baseUrl());
    }

    getConformance(): Observable<StacConformanceResponse> {
        if (!this.conformanceCache$) {
            this.conformanceCache$ = this.http.get<StacConformanceResponse>(`${this.baseUrl()}/conformance`).pipe(
                tap((res) => this.conformanceClasses.set(res.conformsTo)),
                shareReplay({ bufferSize: 1, refCount: true }),
                catchError(() => of({ conformsTo: [] }))
            );
        }
        return this.conformanceCache$;
    }

    getCollections(): Observable<StacCollectionsResponse> {
        if (!this.collectionsCache$) {
            this.collectionsCache$ = this.http.get<StacCollectionsResponse>(`${this.baseUrl()}/collections`).pipe(
                shareReplay({ bufferSize: 1, refCount: true })
            );
        }
        return this.collectionsCache$;
    }

    getCollection(id: string): Observable<StacCollection> {
        return this.http.get<StacCollection>(`${this.baseUrl()}/collections/${encodeURIComponent(id)}`);
    }

    getItems(collectionId: string, limit = 20, params?: Record<string, string>): Observable<StacItemCollection> {
        let httpParams = new HttpParams().set('limit', limit.toString());
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                httpParams = httpParams.set(key, value);
            });
        }
        return this.http.get<StacItemCollection>(
            `${this.baseUrl()}/collections/${encodeURIComponent(collectionId)}/items`,
            { params: httpParams }
        );
    }

    getItem(collectionId: string, itemId: string): Observable<StacItem> {
        return this.http.get<StacItem>(
            `${this.baseUrl()}/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}`
        );
    }

    /**
     * Segue um link STAC (paginação, navegação).
     *
     * Para POST, a spec STAC 1.0 (item-search) permite que o servidor retorne
     * apenas um body parcial (ex.: `{ token }` ou `{ limit, skip }`) sinalizando
     * `merge: true`. O cliente precisa, nesse caso, reenviar o body original
     * mesclado com os campos do link. Como nem todos os servidores populam
     * `merge: true` (o rustac atual emite apenas `{ limit, skip }`), aplicamos
     * a mesclagem defensivamente sempre que `originalBody` é fornecido — é
     * idempotente para servidores que já retornam o request completo.
     */
    followLink<T>(link: StacLink, originalBody?: unknown): Observable<T> {
        const url = link.href.startsWith('http') ? link.href : `${this.baseUrl()}${link.href}`;
        if (link.method === 'POST') {
            const linkBody = (link.body as Record<string, unknown> | undefined) ?? {};
            const base = (originalBody as Record<string, unknown> | undefined) ?? {};
            const body = { ...base, ...linkBody };
            // `merge` é metadado da spec e não deve ser reenviado no próximo request.
            delete (body as Record<string, unknown>)['merge'];
            return this.http.post<T>(url, body, { headers: link.headers });
        }
        return this.http.get<T>(url, { headers: link.headers });
    }

    /** POST /search — busca avançada cross-collection */
    search(request: StacSearchRequest): Observable<StacItemCollection> {
        return this.http.post<StacItemCollection>(`${this.baseUrl()}/search`, request);
    }

    /** Converte SearchFilterState (UI) → StacSearchRequest (API) */
    buildSearchRequest(filters: SearchFilterState, limit = 20): StacSearchRequest {
        const request: StacSearchRequest = { limit };

        if (filters.bbox) {
            request.bbox = filters.bbox;
        }

        if (filters.dateFrom || filters.dateTo) {
            const from = filters.dateFrom ?? '..';
            const to = filters.dateTo ?? '..';
            request.datetime = `${from}/${to}`;
        }

        if (filters.collections.length > 0) {
            request.collections = filters.collections;
        }

        if (filters.freeText.trim()) {
            request.q = filters.freeText.trim().split(/\s+/);
        }

        return request;
    }

    /** Invalida cache de coleções (útil após operações de escrita) */
    invalidateCollectionsCache(): void {
        this.collectionsCache$ = null;
    }
}
