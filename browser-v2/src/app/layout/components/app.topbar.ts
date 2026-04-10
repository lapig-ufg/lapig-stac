import { Component, ElementRef, HostListener, inject, signal, ViewChild, OnInit, DestroyRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StyleClassModule } from 'primeng/styleclass';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TooltipModule } from 'primeng/tooltip';
import { SelectButtonModule } from 'primeng/selectbutton';
import { LayoutService } from '@/app/layout/service/layout.service';
import { AppBreadcrumb } from './app.breadcrumb';
import { StacApiService } from '@/app/core/services/stac-api.service';
import { StacCollection, StacItem } from '@/app/core/models/stac.types';
import { TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, forkJoin, catchError, map } from 'rxjs';

interface SearchResult {
    type: 'collection' | 'item';
    id: string;
    title: string;
    description: string;
    icon: string;
    collection?: string;
}

@Component({
    selector: '[app-topbar]',
    standalone: true,
    imports: [RouterModule, CommonModule, FormsModule, StyleClassModule, AppBreadcrumb, InputTextModule, ButtonModule, IconFieldModule, InputIconModule, TooltipModule, SelectButtonModule],
    styles: `
        :host ::ng-deep .lang-toggle .p-selectbutton {
            border-radius: 8px;
        }
        :host ::ng-deep .lang-toggle .p-togglebutton {
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
            font-size: 0.7rem;
            font-weight: 600;
            letter-spacing: 0.04em;
            padding: 0.35rem 0.6rem;
            min-width: unset;
        }
        .search-container {
            position: relative;
        }
        .search-overlay {
            position: absolute;
            top: calc(100% + 4px);
            right: 0;
            width: 420px;
            max-height: 460px;
            overflow-y: auto;
            background: var(--p-surface-0, var(--surface-card));
            border: 1px solid var(--p-content-border-color, var(--surface-border));
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
            z-index: 1100;
            padding: 0.5rem 0;
        }
        .search-section-label {
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
            font-size: 0.65rem;
            font-weight: 600;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--text-color-secondary);
            padding: 0.6rem 1rem 0.3rem;
        }
        .search-result-item {
            display: flex;
            align-items: flex-start;
            gap: 0.75rem;
            padding: 0.6rem 1rem;
            cursor: pointer;
            transition: background 120ms ease;
            border: none;
            background: none;
            width: 100%;
            text-align: left;
        }
        .search-result-item:hover,
        .search-result-item.active {
            background: var(--p-surface-100, var(--surface-hover));
        }
        .search-result-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: var(--p-primary-50, rgba(26, 77, 46, 0.08));
            color: var(--p-primary-color, #1a4d2e);
            flex-shrink: 0;
            font-size: 0.9rem;
            margin-top: 2px;
        }
        .search-result-content {
            flex: 1;
            min-width: 0;
        }
        .search-result-title {
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--text-color);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .search-result-desc {
            font-size: 0.75rem;
            color: var(--text-color-secondary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-top: 1px;
        }
        .search-result-badge {
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
            font-size: 0.6rem;
            font-weight: 500;
            color: var(--text-color-secondary);
            background: var(--p-surface-100, var(--surface-ground));
            padding: 2px 6px;
            border-radius: 4px;
            flex-shrink: 0;
            margin-top: 4px;
        }
        .search-empty {
            padding: 1.5rem 1rem;
            text-align: center;
            color: var(--text-color-secondary);
            font-size: 0.85rem;
        }
        .search-empty i {
            font-size: 1.5rem;
            display: block;
            margin-bottom: 0.5rem;
            opacity: 0.4;
        }
        .search-loading {
            padding: 1.25rem 1rem;
            text-align: center;
            color: var(--text-color-secondary);
            font-size: 0.8rem;
        }
        .search-footer {
            border-top: 1px solid var(--p-content-border-color, var(--surface-border));
            padding: 0.5rem 1rem;
            margin-top: 0.25rem;
        }
        .search-footer button {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            width: 100%;
            padding: 0.5rem;
            border: none;
            background: none;
            border-radius: 8px;
            cursor: pointer;
            color: var(--p-primary-color, #1a4d2e);
            font-size: 0.8rem;
            font-weight: 600;
            transition: background 120ms ease;
        }
        .search-footer button:hover {
            background: var(--p-surface-100, var(--surface-hover));
        }
        .search-hint {
            padding: 0.4rem 1rem;
            font-size: 0.7rem;
            color: var(--text-color-secondary);
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .search-hint kbd {
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
            font-size: 0.6rem;
            background: var(--p-surface-100, var(--surface-ground));
            border: 1px solid var(--p-content-border-color, var(--surface-border));
            border-radius: 4px;
            padding: 1px 5px;
        }
    `,
    template: `<div class="layout-topbar">
        <div class="topbar-start">
            <button #menubutton type="button" class="topbar-menubutton p-link p-trigger hover:cursor-pointer" (click)="onMenuButtonClick()">
                <i class="pi pi-bars"></i>
            </button>
            <nav app-breadcrumb class="topbar-breadcrumb"></nav>
        </div>

        <div class="topbar-end">
            <ul class="topbar-menu">
                <li class="topbar-search search-container">
                    <p-iconfield>
                        <p-inputicon class="pi pi-search" />
                        <input
                            #searchInput
                            type="text"
                            pInputText
                            [placeholder]="t('search.topbarPlaceholder')"
                            class="w-48 sm:w-full"
                            [(ngModel)]="query"
                            (input)="onQueryChange()"
                            (focus)="onFocus()"
                            (keydown.enter)="onEnter()"
                            (keydown.escape)="closeOverlay()"
                            (keydown.arrowDown)="onArrowDown($event)"
                            (keydown.arrowUp)="onArrowUp($event)"
                            [attr.aria-label]="t('search.topbarPlaceholder')"
                            autocomplete="off"
                        />
                    </p-iconfield>

                    @if (showOverlay()) {
                        <div class="search-overlay">
                            @if (loading()) {
                                <div class="search-loading">
                                    <i class="pi pi-spin pi-spinner"></i> {{ t('search.searching') }}
                                </div>
                            } @else if (results().length === 0 && query.length >= 2) {
                                <div class="search-empty">
                                    <i class="pi pi-search"></i>
                                    {{ t('search.noResultsFor', { query }) }}
                                </div>
                            } @else {
                                @if (collectionResults().length > 0) {
                                    <div class="search-section-label">{{ t('search.sectCollections') }}</div>
                                    @for (item of collectionResults(); track item.id) {
                                        <button
                                            class="search-result-item"
                                            [class.active]="activeIndex() === indexOfResult(item)"
                                            (click)="navigateTo(item)"
                                            (mouseenter)="activeIndex.set(indexOfResult(item))"
                                        >
                                            <span class="search-result-icon"><i class="pi pi-database"></i></span>
                                            <span class="search-result-content">
                                                <span class="search-result-title">{{ item.title }}</span>
                                                <span class="search-result-desc">{{ item.description }}</span>
                                            </span>
                                        </button>
                                    }
                                }
                                @if (itemResults().length > 0) {
                                    <div class="search-section-label">{{ t('search.sectItems') }}</div>
                                    @for (item of itemResults(); track item.id) {
                                        <button
                                            class="search-result-item"
                                            [class.active]="activeIndex() === indexOfResult(item)"
                                            (click)="navigateTo(item)"
                                            (mouseenter)="activeIndex.set(indexOfResult(item))"
                                        >
                                            <span class="search-result-icon"><i class="pi pi-map"></i></span>
                                            <span class="search-result-content">
                                                <span class="search-result-title">{{ item.title }}</span>
                                                <span class="search-result-desc">{{ item.description }}</span>
                                            </span>
                                            @if (item.collection) {
                                                <span class="search-result-badge">{{ item.collection }}</span>
                                            }
                                        </button>
                                    }
                                }
                            }

                            @if (query.length >= 2) {
                                <div class="search-footer">
                                    <button (click)="goToFullSearch()">
                                        <i class="pi pi-arrow-right"></i>
                                        {{ t('search.advancedFor', { query }) }}
                                    </button>
                                </div>
                            }

                            <div class="search-hint">
                                <kbd>↑↓</kbd> {{ t('search.hintNavigate') }} <kbd>↵</kbd> {{ t('search.hintSelect') }} <kbd>Esc</kbd> {{ t('search.hintClose') }}
                            </div>
                        </div>
                    }
                </li>
                <li class="ml-2 lang-toggle">
                    <p-selectbutton
                        [options]="languages"
                        [(ngModel)]="currentLang"
                        (ngModelChange)="onLanguageChange($event)"
                        optionLabel="label"
                        optionValue="value"
                        [allowEmpty]="false"
                    />
                </li>
                <li class="ml-1">
                    <p-button
                        [icon]="layoutService.isDarkTheme() ? 'pi pi-sun' : 'pi pi-moon'"
                        [rounded]="true"
                        [text]="true"
                        (onClick)="onDarkModeToggle()"
                        [pTooltip]="layoutService.isDarkTheme() ? t('theme.light') : t('theme.dark')"
                        tooltipPosition="bottom"
                    ></p-button>
                </li>
            </ul>
        </div>
    </div>`
})
export class AppTopbar implements OnInit {
    @ViewChild('menubutton') menuButton!: ElementRef;
    @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

    layoutService = inject(LayoutService);
    private router = inject(Router);
    private stacApi = inject(StacApiService);
    private translate = inject(TranslateService);
    private destroyRef = inject(DestroyRef);

    private searchSubject = new Subject<string>();

    query = '';
    showOverlay = signal(false);
    loading = signal(false);
    results = signal<SearchResult[]>([]);
    activeIndex = signal(-1);

    collectionResults = signal<SearchResult[]>([]);
    itemResults = signal<SearchResult[]>([]);

    languages = [
        { label: 'PT-BR', value: 'pt-BR' },
        { label: 'EN', value: 'en' }
    ];

    currentLang = 'pt-BR';

    ngOnInit() {
        this.searchSubject.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap((term) => {
                if (term.length < 2) {
                    this.results.set([]);
                    this.collectionResults.set([]);
                    this.itemResults.set([]);
                    this.loading.set(false);
                    return of(null);
                }

                this.loading.set(true);
                const termLower = term.toLowerCase();

                const collections$ = this.stacApi.getCollections().pipe(
                    map((res) =>
                        res.collections
                            .filter((c) => {
                                const title = (c.title || c.id).toLowerCase();
                                const desc = (c.description || '').toLowerCase();
                                const keywords = (c.keywords || []).join(' ').toLowerCase();
                                return title.includes(termLower) || desc.includes(termLower) || keywords.includes(termLower);
                            })
                            .slice(0, 5)
                            .map((c): SearchResult => ({
                                type: 'collection',
                                id: c.id,
                                title: c.title || c.id,
                                description: this.truncate(c.description, 80),
                                icon: 'pi pi-database'
                            }))
                    ),
                    catchError(() => of([] as SearchResult[]))
                );

                const items$ = this.stacApi.search({
                    q: term.trim().split(/\s+/),
                    limit: 5
                }).pipe(
                    map((res) =>
                        res.features.map((item): SearchResult => ({
                            type: 'item',
                            id: item.id,
                            title: item.properties.title || item.id,
                            description: item.collection
                                ? this.t('search.collectionLabel', { name: item.collection })
                                : (item.properties.datetime ? this.t('search.dateLabel', { date: new Date(item.properties.datetime).toLocaleDateString() }) : ''),
                            icon: 'pi pi-map',
                            collection: item.collection
                        }))
                    ),
                    catchError(() => of([] as SearchResult[]))
                );

                return forkJoin([collections$, items$]);
            }),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe((result) => {
            if (!result) return;
            const [collections, items] = result;
            this.collectionResults.set(collections);
            this.itemResults.set(items);
            this.results.set([...collections, ...items]);
            this.activeIndex.set(-1);
            this.loading.set(false);
        });
    }

    onQueryChange() {
        this.showOverlay.set(true);
        this.searchSubject.next(this.query);
    }

    onFocus() {
        if (this.query.length >= 2) {
            this.showOverlay.set(true);
        }
    }

    closeOverlay() {
        this.showOverlay.set(false);
        this.activeIndex.set(-1);
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (!target.closest('.search-container')) {
            this.closeOverlay();
        }
    }

    onArrowDown(event: Event) {
        event.preventDefault();
        const max = this.results().length - 1;
        if (this.activeIndex() < max) {
            this.activeIndex.update((v) => v + 1);
        }
    }

    onArrowUp(event: Event) {
        event.preventDefault();
        if (this.activeIndex() > 0) {
            this.activeIndex.update((v) => v - 1);
        }
    }

    onEnter() {
        const idx = this.activeIndex();
        if (idx >= 0 && idx < this.results().length) {
            this.navigateTo(this.results()[idx]);
        } else if (this.query.length >= 2) {
            this.goToFullSearch();
        }
    }

    navigateTo(item: SearchResult) {
        this.closeOverlay();
        this.query = '';
        if (item.type === 'collection') {
            this.router.navigate(['/collections', item.id]);
        } else if (item.collection) {
            this.router.navigate(['/collections', item.collection, 'items', item.id]);
        }
    }

    goToFullSearch() {
        this.closeOverlay();
        const q = this.query;
        this.query = '';
        this.router.navigate(['/search'], { queryParams: { q } });
    }

    indexOfResult(item: SearchResult): number {
        return this.results().indexOf(item);
    }

    onMenuButtonClick() {
        this.layoutService.toggleMenu();
    }

    onDarkModeToggle() {
        this.layoutService.layoutConfig.update((prev) => ({
            ...prev,
            darkTheme: !prev.darkTheme
        }));
    }

    onLanguageChange(lang: string) {
        this.translate.use(lang);
    }

    /** Shortcut para translate.instant */
    t(key: string, params?: Record<string, unknown>): string {
        return this.translate.instant(key, params);
    }

    private truncate(text: string, maxLen: number): string {
        if (!text) return '';
        return text.length > maxLen ? text.substring(0, maxLen) + '…' : text;
    }
}
