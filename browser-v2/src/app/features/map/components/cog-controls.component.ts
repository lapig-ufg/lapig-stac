import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { SliderModule } from 'primeng/slider';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TooltipModule } from 'primeng/tooltip';
import type { BandInfo, CogStyleConfig, RenderMode, ColorRampId, ClassificationEntry } from '../models/cog-style.types';
import { createDefaultCogStyle } from '../models/cog-style.types';
import { COLOR_RAMP_LABELS, rampToGradient } from '../utils/cog-style.utils';

interface RenderModeOption {
    label: string;
    value: RenderMode;
}

interface ColorRampOption {
    label: string;
    value: ColorRampId;
    gradient: string;
}

@Component({
    selector: 'app-cog-controls',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, SelectModule, SliderModule, SelectButtonModule, TooltipModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    styles: `
        :host {
            position: absolute;
            top: 12px;
            left: 12px;
            z-index: 20;
        }
        .cog-panel {
            background: var(--surface-card);
            border: 1px solid var(--p-content-border-color, var(--surface-border));
            border-radius: 12px;
            padding: 1rem;
            width: 280px;
            max-height: 480px;
            overflow-y: auto;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        }
        .cog-panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 0.75rem;
        }
        .cog-panel-title {
            font-family: var(--font-display, 'Exo 2'), system-ui, sans-serif;
            font-weight: 700;
            font-size: 0.85rem;
            letter-spacing: -0.02em;
            color: var(--text-color);
        }
        .cog-field {
            margin-bottom: 0.65rem;
        }
        .cog-field-label {
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--text-color-secondary);
            margin-bottom: 0.3rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .cog-field-value {
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
            font-size: 0.7rem;
            color: var(--text-color-secondary);
        }
        .ramp-preview {
            height: 14px;
            border-radius: 4px;
            width: 60px;
            display: inline-block;
            vertical-align: middle;
            margin-right: 0.5rem;
        }
        .rgb-row {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 0.5rem;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.2rem 0;
        }
        .legend-swatch {
            width: 16px;
            height: 16px;
            border-radius: 3px;
            border: 1px solid var(--surface-border);
            flex-shrink: 0;
        }
        .legend-label {
            font-size: 0.75rem;
            color: var(--text-color);
        }
        .cog-separator {
            border-top: 1px solid var(--surface-border);
            margin: 0.6rem 0;
        }
    `,
    template: `
        @if (!panelOpen()) {
            <p-button
                icon="pi pi-sliders-h"
                [rounded]="true"
                size="small"
                severity="secondary"
                (onClick)="panelOpen.set(true)"
                pTooltip="Controles COG"
                tooltipPosition="right"
            />
        }

        @if (panelOpen()) {
            <div class="cog-panel">
                <div class="cog-panel-header">
                    <span class="cog-panel-title">Visualização COG</span>
                    <p-button
                        icon="pi pi-times"
                        [rounded]="true"
                        [text]="true"
                        size="small"
                        (onClick)="panelOpen.set(false)"
                    />
                </div>

                <!-- Modo de renderização -->
                @if (bands().length >= 3 || config().classificationClasses?.length) {
                    <div class="cog-field">
                        <div class="cog-field-label">Modo</div>
                        <p-selectbutton
                            [options]="availableRenderModes()"
                            [ngModel]="config().renderMode"
                            (ngModelChange)="updateField('renderMode', $event)"
                            optionLabel="label"
                            optionValue="value"
                            size="small"
                            styleClass="w-full"
                        />
                    </div>
                }

                <!-- Legenda de classificação -->
                @if (config().renderMode === 'classified' && config().classificationClasses?.length) {
                    <div class="cog-field">
                        <div class="cog-field-label">Legenda</div>
                        @for (entry of config().classificationClasses!; track entry.value) {
                            @if (entry.color !== '#00000000') {
                                <div class="legend-item">
                                    <span class="legend-swatch" [style.background]="entry.color"></span>
                                    <span class="legend-label">{{ entry.label }}</span>
                                </div>
                            }
                        }
                    </div>
                }

                <!-- Controles Singleband -->
                @if (config().renderMode === 'singleband') {
                    @if (bands().length > 1) {
                        <div class="cog-field">
                            <div class="cog-field-label">Banda</div>
                            <p-select
                                [options]="bands()"
                                [ngModel]="config().selectedBand"
                                (ngModelChange)="updateField('selectedBand', $event)"
                                optionLabel="name"
                                optionValue="index"
                                appendTo="body"
                                size="small"
                                styleClass="w-full"
                            />
                        </div>
                    }

                    <div class="cog-field">
                        <div class="cog-field-label">Rampa de cor</div>
                        <p-select
                            [options]="colorRampOptions"
                            [ngModel]="config().colorRamp"
                            (ngModelChange)="updateField('colorRamp', $event)"
                            optionLabel="label"
                            optionValue="value"
                            appendTo="body"
                            size="small"
                            styleClass="w-full"
                        >
                            <ng-template #selectedItem let-selected>
                                @if (selected) {
                                    <div class="flex items-center gap-2">
                                        <span class="ramp-preview" [style.background]="selected.gradient"></span>
                                        {{ selected.label }}
                                    </div>
                                }
                            </ng-template>
                            <ng-template #item let-option>
                                <div class="flex items-center gap-2">
                                    <span class="ramp-preview" [style.background]="option.gradient"></span>
                                    {{ option.label }}
                                </div>
                            </ng-template>
                        </p-select>
                    </div>

                    <div class="cog-field">
                        <div class="cog-field-label">
                            <span>Mín</span>
                            <span class="cog-field-value">{{ config().min | number:'1.2-2' }}</span>
                        </div>
                        <p-slider
                            [ngModel]="config().min"
                            (ngModelChange)="updateField('min', $event)"
                            [min]="0" [max]="10000" [step]="1"
                            styleClass="w-full"
                        />
                    </div>
                    <div class="cog-field">
                        <div class="cog-field-label">
                            <span>Máx</span>
                            <span class="cog-field-value">{{ config().max | number:'1.2-2' }}</span>
                        </div>
                        <p-slider
                            [ngModel]="config().max"
                            (ngModelChange)="updateField('max', $event)"
                            [min]="0" [max]="10000" [step]="1"
                            styleClass="w-full"
                        />
                    </div>
                }

                <!-- Controles RGB -->
                @if (config().renderMode === 'rgb' && bands().length >= 3) {
                    <div class="cog-field">
                        <div class="cog-field-label">Composição RGB</div>
                        <div class="rgb-row">
                            <div>
                                <div class="cog-field-label" style="color: #e74c3c;">R</div>
                                <p-select
                                    [options]="bands()"
                                    [ngModel]="config().redBand"
                                    (ngModelChange)="updateField('redBand', $event)"
                                    optionLabel="name"
                                    optionValue="index"
                                    appendTo="body"
                                    size="small"
                                    styleClass="w-full"
                                />
                            </div>
                            <div>
                                <div class="cog-field-label" style="color: #2ecc71;">G</div>
                                <p-select
                                    [options]="bands()"
                                    [ngModel]="config().greenBand"
                                    (ngModelChange)="updateField('greenBand', $event)"
                                    optionLabel="name"
                                    optionValue="index"
                                    appendTo="body"
                                    size="small"
                                    styleClass="w-full"
                                />
                            </div>
                            <div>
                                <div class="cog-field-label" style="color: #3498db;">B</div>
                                <p-select
                                    [options]="bands()"
                                    [ngModel]="config().blueBand"
                                    (ngModelChange)="updateField('blueBand', $event)"
                                    optionLabel="name"
                                    optionValue="index"
                                    appendTo="body"
                                    size="small"
                                    styleClass="w-full"
                                />
                            </div>
                        </div>
                    </div>
                }

                <div class="cog-separator"></div>

                <!-- Ajustes globais -->
                <div class="cog-field">
                    <div class="cog-field-label">
                        <span>Opacidade</span>
                        <span class="cog-field-value">{{ (config().opacity * 100) | number:'1.0-0' }}%</span>
                    </div>
                    <p-slider
                        [ngModel]="config().opacity"
                        (ngModelChange)="updateField('opacity', $event)"
                        [min]="0" [max]="1" [step]="0.05"
                        styleClass="w-full"
                    />
                </div>

                <div class="cog-field">
                    <div class="cog-field-label">
                        <span>Exposição</span>
                        <span class="cog-field-value">{{ config().exposure | number:'1.2-2' }}</span>
                    </div>
                    <p-slider
                        [ngModel]="config().exposure"
                        (ngModelChange)="updateField('exposure', $event)"
                        [min]="-1" [max]="1" [step]="0.05"
                        styleClass="w-full"
                    />
                </div>

                <div class="cog-field">
                    <div class="cog-field-label">
                        <span>Contraste</span>
                        <span class="cog-field-value">{{ config().contrast | number:'1.2-2' }}</span>
                    </div>
                    <p-slider
                        [ngModel]="config().contrast"
                        (ngModelChange)="updateField('contrast', $event)"
                        [min]="-1" [max]="1" [step]="0.05"
                        styleClass="w-full"
                    />
                </div>

                <div class="cog-field">
                    <div class="cog-field-label">
                        <span>Saturação</span>
                        <span class="cog-field-value">{{ config().saturation | number:'1.2-2' }}</span>
                    </div>
                    <p-slider
                        [ngModel]="config().saturation"
                        (ngModelChange)="updateField('saturation', $event)"
                        [min]="-1" [max]="1" [step]="0.05"
                        styleClass="w-full"
                    />
                </div>

                <!-- Reset -->
                <p-button
                    label="Redefinir"
                    icon="pi pi-refresh"
                    severity="secondary"
                    [outlined]="true"
                    size="small"
                    (onClick)="reset()"
                    styleClass="w-full mt-2"
                />
            </div>
        }
    `
})
export class CogControlsComponent {
    bands = input<BandInfo[]>([{ index: 1, name: 'Band 1' }]);
    config = input.required<CogStyleConfig>();
    configChange = output<CogStyleConfig>();

    panelOpen = signal(false);

    private readonly allRenderModes: RenderModeOption[] = [
        { label: 'Classificado', value: 'classified' },
        { label: 'Banda única', value: 'singleband' },
        { label: 'RGB', value: 'rgb' }
    ];

    availableRenderModes = (): RenderModeOption[] => {
        const modes: RenderModeOption[] = [];
        if (this.config().classificationClasses?.length) {
            modes.push(this.allRenderModes[0]); // classified
        }
        modes.push(this.allRenderModes[1]); // singleband
        if (this.bands().length >= 3) {
            modes.push(this.allRenderModes[2]); // rgb
        }
        return modes;
    };

    readonly colorRampOptions: ColorRampOption[] = (
        Object.entries(COLOR_RAMP_LABELS) as [ColorRampId, string][]
    ).map(([value, label]) => ({
        label,
        value,
        gradient: rampToGradient(value)
    }));

    updateField<K extends keyof CogStyleConfig>(field: K, value: CogStyleConfig[K]) {
        this.configChange.emit({ ...this.config(), [field]: value });
    }

    reset() {
        const bandCount = this.bands().length;
        const classes = this.config().classificationClasses;
        this.configChange.emit(createDefaultCogStyle(bandCount, classes ?? undefined));
    }
}
