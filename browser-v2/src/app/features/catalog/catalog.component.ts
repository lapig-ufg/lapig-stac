import { Component, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MessageModule } from 'primeng/message';
import { StacApiService } from '@/app/core/services/stac-api.service';
import { StacCollection } from '@/app/core/models/stac.types';
import { CollectionCardComponent } from '@/app/shared/components/collection-card/collection-card.component';
import { CollectionCardSkeletonComponent } from '@/app/shared/components/loading-skeleton/collection-card-skeleton.component';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
    selector: 'app-catalog',
    standalone: true,
    imports: [CommonModule, MessageModule, CollectionCardComponent, CollectionCardSkeletonComponent, TranslatePipe],
    template: `
        <div class="mb-6">
            <span class="font-mono text-xs uppercase tracking-widest" style="color: var(--color-cerrado-gold, #C4933F); letter-spacing: 0.12em;">
                {{ 'catalog.overline' | translate }}
            </span>
            <h1 class="text-3xl font-bold mt-2" style="font-family: var(--font-display, 'Exo 2'), system-ui, sans-serif; font-weight: 900; letter-spacing: -0.035em;">
                {{ 'catalog.title' | translate }}
            </h1>
        </div>

        @if (loading()) {
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                @for (i of skeletons; track i) {
                    <app-collection-card-skeleton />
                }
            </div>
        } @else if (error()) {
            <p-message severity="error" [text]="error()!" styleClass="w-full" />
        } @else if (collections().length === 0) {
            <div class="card text-center py-12">
                <i class="pi pi-database text-5xl text-muted-color mb-4"></i>
                <p class="text-lg text-muted-color">{{ 'catalog.empty' | translate }}</p>
            </div>
        } @else {
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                @for (collection of collections(); track collection.id) {
                    <app-collection-card
                        [collection]="collection"
                        [thumbnailUrl]="getThumbnail(collection)"
                        (navigate)="onNavigate($event)"
                    />
                }
            </div>
        }
    `
})
export class CatalogComponent {
    private stacApi = inject(StacApiService);
    private router = inject(Router);
    private destroyRef = inject(DestroyRef);

    collections = signal<StacCollection[]>([]);
    loading = signal(true);
    error = signal<string | null>(null);
    skeletons = Array.from({ length: 6 }, (_, i) => i);

    constructor() {
        this.stacApi.getCollections().pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: (data) => {
                this.collections.set(data.collections);
                this.loading.set(false);
            },
            error: () => {
                this.error.set('Erro ao carregar coleções. Verifique se a API STAC está acessível.');
                this.loading.set(false);
            }
        });
    }

    getThumbnail(collection: StacCollection): string | undefined {
        return collection.assets?.['thumbnail']?.href;
    }

    onNavigate(collectionId: string) {
        this.router.navigate(['/collections', collectionId]);
    }
}
