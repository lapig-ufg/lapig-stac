import { Component, inject, signal, computed, HostListener, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TranslatePipe } from '@ngx-translate/core';
import { StacApiService } from '@/app/core/services/stac-api.service';
import { StacCollection } from '@/app/core/models/stac.types';
import { LayoutService } from '@/app/layout/service/layout.service';

interface PaletteItem {
    id: string;
    label: string;
    description?: string;
    icon: string;
    section: 'collections' | 'navigation' | 'actions';
    action: () => void;
}

@Component({
    selector: 'app-command-palette',
    standalone: true,
    imports: [CommonModule, FormsModule, DialogModule, InputTextModule, IconFieldModule, InputIconModule, TranslatePipe],
    styles: `
        :host ::ng-deep .command-palette-dialog .p-dialog-content {
            padding: 0;
            max-height: 60vh;
            overflow: hidden;
        }
        :host ::ng-deep .command-palette-dialog .p-dialog-header {
            display: none;
        }
        :host ::ng-deep .command-palette-dialog {
            border-radius: 12px;
            overflow: hidden;
        }
        .palette-input-wrapper {
            padding: 1rem;
            border-bottom: 1px solid var(--surface-border);
        }
        .palette-results {
            max-height: 50vh;
            overflow-y: auto;
            padding: 0.5rem 0;
        }
        .palette-section {
            padding: 0.5rem 1rem 0.25rem;
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
            font-size: 0.65rem;
            font-weight: 600;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--text-color-secondary);
        }
        .palette-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.6rem 1rem;
            cursor: pointer;
            transition: background-color 80ms ease;
        }
        .palette-item:hover, .palette-item.active {
            background-color: var(--p-highlight-background);
        }
        .palette-item-icon {
            width: 2rem;
            height: 2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            background: var(--p-surface-100);
            flex-shrink: 0;
        }
        .palette-item-label {
            font-weight: 500;
            font-size: 0.9rem;
        }
        .palette-item-desc {
            font-size: 0.75rem;
            color: var(--text-color-secondary);
        }
        .palette-shortcut {
            margin-left: auto;
            font-family: var(--font-mono, monospace);
            font-size: 0.7rem;
            color: var(--text-color-secondary);
            background: var(--p-surface-100);
            padding: 2px 6px;
            border-radius: 4px;
        }
        .palette-empty {
            padding: 2rem 1rem;
            text-align: center;
            color: var(--text-color-secondary);
        }
    `,
    template: `
        <p-dialog
            [(visible)]="visible"
            [modal]="true"
            [dismissableMask]="true"
            [showHeader]="false"
            [style]="{ width: '560px' }"
            styleClass="command-palette-dialog"
            [closable]="true"
        >
            <div class="palette-input-wrapper">
                <p-iconfield>
                    <p-inputicon class="pi pi-search" />
                    <input
                        #searchInput
                        type="text"
                        pInputText
                        [(ngModel)]="query"
                        (ngModelChange)="onQueryChange()"
                        (keydown.arrowDown)="onArrowDown($event)"
                        (keydown.arrowUp)="onArrowUp($event)"
                        (keydown.enter)="onEnter()"
                        (keydown.escape)="close()"
                        [placeholder]="'commandPalette.placeholder' | translate"
                        class="w-full"
                        autofocus
                    />
                </p-iconfield>
            </div>

            <div class="palette-results">
                @if (filteredItems().length === 0 && query.length > 0) {
                    <div class="palette-empty">
                        <i class="pi pi-search text-2xl mb-2"></i>
                        <p>{{ 'commandPalette.noResults' | translate: { query } }}</p>
                    </div>
                } @else {
                    @for (section of sections(); track section.key) {
                        @if (section.items.length > 0) {
                            <div class="palette-section">{{ section.label }}</div>
                            @for (item of section.items; track item.id; let i = $index) {
                                <div
                                    class="palette-item"
                                    [class.active]="activeIndex() === getGlobalIndex(section.key, i)"
                                    (click)="executeItem(item)"
                                    (mouseenter)="activeIndex.set(getGlobalIndex(section.key, i))"
                                >
                                    <div class="palette-item-icon">
                                        <i [class]="item.icon"></i>
                                    </div>
                                    <div>
                                        <div class="palette-item-label">{{ item.label }}</div>
                                        @if (item.description) {
                                            <div class="palette-item-desc">{{ item.description }}</div>
                                        }
                                    </div>
                                </div>
                            }
                        }
                    }
                }
            </div>
        </p-dialog>
    `
})
export class CommandPaletteComponent {
    private router = inject(Router);
    private stacApi = inject(StacApiService);
    private layoutService = inject(LayoutService);
    private destroyRef = inject(DestroyRef);

    visible = false;
    query = '';
    activeIndex = signal(0);

    private collections = signal<StacCollection[]>([]);
    private allItems = signal<PaletteItem[]>([]);

    filteredItems = computed(() => {
        const q = this.query.toLowerCase().trim();
        const items = this.allItems();
        if (!q) return items;
        return items.filter((item) =>
            item.label.toLowerCase().includes(q) ||
            (item.description?.toLowerCase().includes(q) ?? false)
        );
    });

    sections = computed(() => {
        const items = this.filteredItems();
        return [
            { key: 'collections' as const, label: 'Coleções', items: items.filter((i) => i.section === 'collections') },
            { key: 'navigation' as const, label: 'Navegação', items: items.filter((i) => i.section === 'navigation') },
            { key: 'actions' as const, label: 'Ações', items: items.filter((i) => i.section === 'actions') }
        ];
    });

    constructor() {
        this.stacApi.getCollections().pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: (data) => {
                this.collections.set(data.collections);
                this.buildItems();
            }
        });
        this.buildItems();
    }

    @HostListener('document:keydown', ['$event'])
    onGlobalKeydown(event: KeyboardEvent) {
        if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
            event.preventDefault();
            this.toggle();
        }
    }

    toggle() {
        this.visible = !this.visible;
        if (this.visible) {
            this.query = '';
            this.activeIndex.set(0);
        }
    }

    close() {
        this.visible = false;
    }

    onQueryChange() {
        this.activeIndex.set(0);
    }

    onArrowDown(event: Event) {
        event.preventDefault();
        const max = this.filteredItems().length - 1;
        this.activeIndex.update((i) => Math.min(i + 1, max));
    }

    onArrowUp(event: Event) {
        event.preventDefault();
        this.activeIndex.update((i) => Math.max(i - 1, 0));
    }

    onEnter() {
        const items = this.filteredItems();
        const idx = this.activeIndex();
        if (items[idx]) {
            this.executeItem(items[idx]);
        }
    }

    executeItem(item: PaletteItem) {
        this.close();
        item.action();
    }

    getGlobalIndex(sectionKey: string, localIndex: number): number {
        const items = this.filteredItems();
        const sectionItems = items.filter((i) => i.section === sectionKey);
        const firstInSection = items.indexOf(sectionItems[0]);
        return firstInSection + localIndex;
    }

    private buildItems() {
        const items: PaletteItem[] = [];

        // Coleções
        for (const col of this.collections()) {
            items.push({
                id: `col-${col.id}`,
                label: col.title || col.id,
                description: col.description?.substring(0, 80),
                icon: 'pi pi-folder',
                section: 'collections',
                action: () => this.router.navigate(['/collections', col.id])
            });
        }

        // Navegação
        items.push(
            { id: 'nav-catalog', label: 'Catálogo', icon: 'pi pi-th-large', section: 'navigation', action: () => this.router.navigate(['/catalog']) },
            { id: 'nav-search', label: 'Buscar dados', icon: 'pi pi-search', section: 'navigation', action: () => this.router.navigate(['/search']) }
        );

        // Ações
        items.push(
            {
                id: 'act-dark',
                label: this.layoutService.isDarkTheme() ? 'Modo claro' : 'Modo escuro',
                icon: this.layoutService.isDarkTheme() ? 'pi pi-sun' : 'pi pi-moon',
                section: 'actions',
                action: () => this.layoutService.layoutConfig.update((prev) => ({ ...prev, darkTheme: !prev.darkTheme }))
            }
        );

        this.allItems.set(items);
    }
}
