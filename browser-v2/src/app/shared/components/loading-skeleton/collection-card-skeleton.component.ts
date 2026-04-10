import { Component } from '@angular/core';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
    selector: 'app-collection-card-skeleton',
    standalone: true,
    imports: [SkeletonModule],
    template: `
        <div class="card p-0 overflow-hidden">
            <p-skeleton width="100%" height="180px" borderRadius="0" />
            <div class="p-4 flex flex-col gap-3">
                <p-skeleton width="40%" height="0.65rem" />
                <p-skeleton width="75%" height="1.2rem" />
                <p-skeleton width="100%" height="0.85rem" />
                <p-skeleton width="90%" height="0.85rem" />
                <div class="flex gap-2 mt-1">
                    <p-skeleton width="60px" height="1.5rem" borderRadius="12px" />
                    <p-skeleton width="80px" height="1.5rem" borderRadius="12px" />
                    <p-skeleton width="50px" height="1.5rem" borderRadius="12px" />
                </div>
            </div>
        </div>
    `
})
export class CollectionCardSkeletonComponent {}
