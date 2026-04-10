import { Component, inject, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

interface Breadcrumb {
    label: string;
    url?: string;
}

@Component({
    selector: '[app-breadcrumb]',
    standalone: true,
    imports: [CommonModule, RouterModule],
    template: `<nav class="layout-breadcrumb" aria-label="Navegação estrutural">
        <ol>
            @for (item of breadcrumbs(); track item.url; let last = $last) {
                <li>
                    @if (item.url && !last) {
                        <a [routerLink]="item.url" class="hover:text-primary transition-colors">{{ item.label }}</a>
                    } @else {
                        <span [attr.aria-current]="last ? 'page' : null">{{ item.label }}</span>
                    }
                </li>
                @if (!last) {
                    <li class="layout-breadcrumb-chevron" aria-hidden="true">/</li>
                }
            }
        </ol>
    </nav> `
})
export class AppBreadcrumb {
    private router = inject(Router);
    private destroyRef = inject(DestroyRef);

    breadcrumbs = signal<Breadcrumb[]>([]);

    constructor() {
        this.router.events.pipe(
            filter((event) => event instanceof NavigationEnd),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(() => {
            const root = this.router.routerState.snapshot.root;
            const items: Breadcrumb[] = [];
            this.buildBreadcrumbs(root, [], items);
            this.breadcrumbs.set(items);
        });
    }

    private buildBreadcrumbs(route: ActivatedRouteSnapshot, parentUrl: string[], breadcrumbs: Breadcrumb[]) {
        const routeUrl = parentUrl.concat(route.url.map((url) => url.path));
        const breadcrumb = route.data['breadcrumb'];
        const parentBreadcrumb = route.parent?.data?.['breadcrumb'] ?? null;

        if (breadcrumb && breadcrumb !== parentBreadcrumb) {
            let label = breadcrumb as string;
            const collectionId = route.paramMap.get('collectionId');
            const itemId = route.paramMap.get('itemId');

            if (itemId) {
                label = itemId;
            } else if (collectionId) {
                label = collectionId;
            }

            breadcrumbs.push({
                label,
                url: '/' + routeUrl.join('/')
            });
        }

        if (route.firstChild) {
            this.buildBreadcrumbs(route.firstChild, routeUrl, breadcrumbs);
        }
    }
}
