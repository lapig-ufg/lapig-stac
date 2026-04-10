import { CommonModule } from '@angular/common';
import { booleanAttribute, Component, computed, inject, Input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LayoutService } from '@/app/layout/service/layout.service';
import { DrawerModule } from 'primeng/drawer';
import { RadioButtonModule } from 'primeng/radiobutton';

@Component({
    selector: 'app-configurator',
    standalone: true,
    imports: [CommonModule, FormsModule, DrawerModule, RadioButtonModule],
    template: `
        <p-drawer [visible]="visible()" (onHide)="onDrawerHide()" position="right" [transitionOptions]="'.3s cubic-bezier(0, 0, 0.2, 1)'" styleClass="layout-config-sidebar w-80" header="Configurações">
            <div class="flex flex-col gap-4">
                <div *ngIf="!simple" class="flex flex-col gap-2">
                    <span class="text-lg font-semibold">Tipo de menu</span>
                    <div class="flex flex-wrap flex-col gap-3">
                        <div class="flex">
                            <div class="flex items-center gap-2 w-1/2">
                                <p-radiobutton name="menuMode" value="static" [(ngModel)]="menuMode" (ngModelChange)="setMenuMode('static')" inputId="static"></p-radiobutton>
                                <label for="static">Estático</label>
                            </div>
                            <div class="flex items-center gap-2 w-1/2">
                                <p-radiobutton name="menuMode" value="overlay" [(ngModel)]="menuMode" (ngModelChange)="setMenuMode('overlay')" inputId="overlay"></p-radiobutton>
                                <label for="overlay">Overlay</label>
                            </div>
                        </div>
                        <div class="flex">
                            <div class="flex items-center gap-2 w-1/2">
                                <p-radiobutton name="menuMode" value="slim" [(ngModel)]="menuMode" (ngModelChange)="setMenuMode('slim')" inputId="slim"></p-radiobutton>
                                <label for="slim">Slim</label>
                            </div>
                            <div class="flex items-center gap-2 w-1/2">
                                <p-radiobutton name="menuMode" value="slim-plus" [(ngModel)]="menuMode" (ngModelChange)="setMenuMode('slim-plus')" inputId="slim-plus"></p-radiobutton>
                                <label for="slim-plus">Slim+</label>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 w-1/2">
                            <p-radiobutton name="menuMode" value="horizontal" [(ngModel)]="menuMode" (ngModelChange)="setMenuMode('horizontal')" inputId="horizontal"></p-radiobutton>
                            <label for="horizontal">Horizontal</label>
                        </div>
                    </div>
                </div>
            </div>
        </p-drawer>
    `
})
export class AppConfigurator {
    @Input({ transform: booleanAttribute }) simple: boolean = false;

    layoutService = inject(LayoutService);

    menuMode = model(this.layoutService.layoutConfig().menuMode);

    visible: any = computed(() => this.layoutService.layoutState().configSidebarVisible);

    onDrawerHide() {
        this.layoutService.layoutState.update((prev) => ({ ...prev, configSidebarVisible: false }));
    }

    setMenuMode(mode: string) {
        this.layoutService.layoutConfig.update((prev) => ({
            ...prev,
            menuMode: mode
        }));

        if (mode === 'static') {
            this.layoutService.layoutState.update((prev) => ({
                ...prev,
                staticMenuInactive: false
            }));
        }
    }
}
