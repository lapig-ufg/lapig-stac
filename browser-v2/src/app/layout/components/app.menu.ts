import { Component, inject, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { AppMenuitem } from './app.menuitem';

@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [CommonModule, AppMenuitem, RouterModule],
    template: `<ul class="layout-menu">
        @for (item of model; track item.label) {
            @if (!item.separator) {
                <li app-menuitem [item]="item" [root]="true"></li>
            } @else {
                <li class="menu-separator"></li>
            }
        }
    </ul> `
})
export class AppMenu implements OnInit {
    private translate = inject(TranslateService);
    private destroyRef = inject(DestroyRef);

    model: any[] = [];

    ngOnInit() {
        this.translate.onLangChange.pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(() => this.buildMenu());

        this.buildMenu();
    }

    private buildMenu() {
        const t = (key: string) => this.translate.instant(key);
        this.model = [
            {
                label: t('nav.navigation'),
                icon: 'pi pi-compass',
                path: '/nav',
                items: [
                    { label: t('nav.catalog'), icon: 'pi pi-fw pi-th-large', routerLink: ['/catalog'] },
                    { label: t('nav.search'), icon: 'pi pi-fw pi-search', routerLink: ['/search'] }
                ]
            }
        ];
    }
}
