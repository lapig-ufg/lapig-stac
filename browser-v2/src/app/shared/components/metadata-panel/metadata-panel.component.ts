import { Component, input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FieldsetModule } from 'primeng/fieldset';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';
import { StacDatetimePipe } from '@/app/shared/pipes/datetime.pipe';
import { ClipboardService } from '@/app/core/services/clipboard.service';

interface MetadataGroup {
    namespace: string;
    label: string;
    entries: MetadataEntry[];
}

interface MetadataEntry {
    key: string;
    label: string;
    value: unknown;
    type: 'text' | 'date' | 'number' | 'coordinate' | 'link' | 'list' | 'object-list' | 'json';
}

const NAMESPACE_LABELS: Record<string, string> = {
    core: 'Propriedades gerais',
    'eo': 'Earth Observation (EO)',
    'sar': 'SAR',
    'proj': 'Projeção',
    'view': 'Geometria de visada',
    'sat': 'Satélite',
    'raster': 'Raster',
    'file': 'Arquivo',
    other: 'Outros'
};

const CORE_KEYS = new Set([
    'datetime', 'start_datetime', 'end_datetime', 'title', 'description',
    'created', 'updated', 'platform', 'instruments', 'constellation',
    'mission', 'gsd', 'license'
]);

const DATE_KEYS = new Set([
    'datetime', 'start_datetime', 'end_datetime', 'created', 'updated'
]);

const HIDDEN_KEYS = new Set([
    'providers' // já exibido na coleção
]);

@Component({
    selector: 'app-metadata-panel',
    standalone: true,
    imports: [CommonModule, FieldsetModule, ButtonModule, TooltipModule, BadgeModule, StacDatetimePipe],
    styles: `
        .metadata-group {
            margin-bottom: 1rem;
        }
        .metadata-entry {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 0.5rem 0;
            border-bottom: 1px solid var(--surface-border);
            gap: 1rem;
        }
        .metadata-entry:last-child {
            border-bottom: none;
        }
        .metadata-key {
            font-size: 0.8rem;
            color: var(--text-color-secondary);
            min-width: 140px;
            flex-shrink: 0;
        }
        .metadata-value {
            font-size: 0.875rem;
            text-align: right;
            word-break: break-word;
        }
        .metadata-value-mono {
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
            font-size: 0.8rem;
        }
        .copy-trigger {
            opacity: 0;
            transition: opacity 120ms ease;
        }
        .metadata-entry:hover .copy-trigger {
            opacity: 1;
        }
        :host ::ng-deep .p-fieldset-legend {
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
            font-size: 0.68rem;
            font-weight: 600;
            letter-spacing: 0.12em;
            text-transform: uppercase;
        }
    `,
    template: `
        @for (group of groups(); track group.namespace) {
            <p-fieldset [legend]="group.label" [toggleable]="true" class="metadata-group mb-4">
                @for (entry of group.entries; track entry.key) {
                    <div class="metadata-entry">
                        <span class="metadata-key">{{ entry.label }}</span>
                        <div class="flex items-center gap-2">
                            <span [class]="isMonoValue(entry) ? 'metadata-value metadata-value-mono' : 'metadata-value'">
                                @switch (entry.type) {
                                    @case ('date') {
                                        {{ asString(entry.value) | stacDatetime: 'full' }}
                                    }
                                    @case ('number') {
                                        {{ formatNumber(entry.value) }}
                                    }
                                    @case ('coordinate') {
                                        <span class="metadata-value-mono">{{ formatCoordinate(entry.value) }}</span>
                                    }
                                    @case ('link') {
                                        <a [href]="asString(entry.value)" target="_blank" rel="noopener" class="text-primary hover:underline">
                                            {{ asString(entry.value) }}
                                        </a>
                                    }
                                    @case ('list') {
                                        <span class="flex flex-wrap gap-1 justify-end">
                                            @for (item of asList(entry.value); track item) {
                                                <p-badge [value]="item" severity="secondary" />
                                            }
                                        </span>
                                    }
                                    @case ('object-list') {
                                        <div class="w-full">
                                            @for (obj of asObjectList(entry.value); track $index) {
                                                <div class="mb-2 p-2 rounded" style="background: var(--p-content-hover-background); border: 1px solid var(--surface-border);">
                                                    <span class="font-mono text-xs font-semibold text-muted-color mb-1 block">
                                                        #{{ $index + 1 }}
                                                    </span>
                                                    @for (prop of objectEntries(obj); track prop.key) {
                                                        <div class="flex justify-between gap-2 py-1" style="border-bottom: 1px solid var(--surface-border); font-size: 0.8rem;">
                                                            <span class="text-muted-color" style="min-width: 100px;">{{ formatLabel(prop.key) }}</span>
                                                            <span class="metadata-value-mono text-right" style="font-size: 0.75rem;">
                                                                @if (isObject(prop.value)) {
                                                                    @for (sub of objectEntries(prop.value); track sub.key) {
                                                                        <div class="flex justify-between gap-2">
                                                                            <span class="text-muted-color">{{ formatLabel(sub.key) }}:</span>
                                                                            <span>{{ formatAny(sub.value) }}</span>
                                                                        </div>
                                                                    }
                                                                } @else {
                                                                    {{ formatAny(prop.value) }}
                                                                }
                                                            </span>
                                                        </div>
                                                    }
                                                </div>
                                            }
                                        </div>
                                    }
                                    @case ('json') {
                                        <code class="metadata-value-mono text-xs">{{ formatJson(entry.value) }}</code>
                                    }
                                    @default {
                                        {{ asString(entry.value) }}
                                    }
                                }
                            </span>
                            <p-button
                                icon="pi pi-copy"
                                [rounded]="true"
                                [text]="true"
                                size="small"
                                class="copy-trigger"
                                pTooltip="Copiar"
                                tooltipPosition="left"
                                (onClick)="copyValue(entry)"
                            />
                        </div>
                    </div>
                }
            </p-fieldset>
        }

        @if (groups().length === 0) {
            <div class="text-center py-6 text-muted-color">
                <i class="pi pi-info-circle text-2xl mb-2"></i>
                <p>Sem metadados disponíveis.</p>
            </div>
        }
    `
})
export class MetadataPanelComponent {
    private clipboard = inject(ClipboardService);

    properties = input.required<Record<string, unknown>>();
    extensions = input<string[]>([]);

    groups = computed<MetadataGroup[]>(() => {
        const props = this.properties();
        if (!props) return [];

        const grouped = new Map<string, MetadataEntry[]>();

        for (const [key, value] of Object.entries(props)) {
            if (value === null || value === undefined || HIDDEN_KEYS.has(key)) continue;

            const ns = this.getNamespace(key);
            if (!grouped.has(ns)) grouped.set(ns, []);
            grouped.get(ns)!.push({
                key,
                label: this.formatLabelFromKey(key),
                value,
                type: this.detectType(key, value)
            });
        }

        // Ordenar: core primeiro, depois namespaces alfabeticamente, "other" por último
        const order = ['core', 'eo', 'sar', 'proj', 'view', 'sat', 'raster', 'file', 'other'];
        const result: MetadataGroup[] = [];

        for (const ns of order) {
            const entries = grouped.get(ns);
            if (entries && entries.length > 0) {
                result.push({
                    namespace: ns,
                    label: NAMESPACE_LABELS[ns] || ns,
                    entries
                });
            }
        }

        // Namespaces não listados em order
        for (const [ns, entries] of grouped) {
            if (!order.includes(ns) && entries.length > 0) {
                result.push({
                    namespace: ns,
                    label: NAMESPACE_LABELS[ns] || ns,
                    entries
                });
            }
        }

        return result;
    });

    private getNamespace(key: string): string {
        if (CORE_KEYS.has(key)) return 'core';
        const colonIdx = key.indexOf(':');
        if (colonIdx > 0) return key.substring(0, colonIdx);
        return 'other';
    }

    formatLabelFromKey(key: string): string {
        const colonIdx = key.indexOf(':');
        const shortKey = colonIdx > 0 ? key.substring(colonIdx + 1) : key;
        return shortKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }

    private detectType(key: string, value: unknown): MetadataEntry['type'] {
        if (DATE_KEYS.has(key)) return 'date';
        if (key === 'proj:epsg') return 'link';
        if (Array.isArray(value)) {
            if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
                return 'object-list';
            }
            return 'list';
        }
        if (typeof value === 'number') return 'number';
        if (typeof value === 'object') return 'json';
        if (typeof value === 'string' && value.startsWith('http')) return 'link';
        return 'text';
    }

    isMonoValue(entry: MetadataEntry): boolean {
        return entry.type === 'coordinate' || entry.type === 'number' || entry.key.startsWith('proj:');
    }

    asString(value: unknown): string {
        if (value === null || value === undefined) return '—';
        return String(value);
    }

    asList(value: unknown): string[] {
        if (Array.isArray(value)) return value.map(String);
        return [];
    }

    formatNumber(value: unknown): string {
        if (typeof value !== 'number') return String(value);
        if (Number.isInteger(value)) return value.toLocaleString('pt-BR');
        return value.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
    }

    formatCoordinate(value: unknown): string {
        if (typeof value !== 'number') return String(value);
        return value.toFixed(6);
    }

    formatJson(value: unknown): string {
        try {
            const str = JSON.stringify(value);
            return str.length > 80 ? str.substring(0, 77) + '...' : str;
        } catch {
            return String(value);
        }
    }

    asObjectList(value: unknown): Record<string, unknown>[] {
        if (Array.isArray(value)) {
            return value.filter((v) => typeof v === 'object' && v !== null);
        }
        return [];
    }

    objectEntries(obj: unknown): Array<{ key: string; value: unknown }> {
        if (typeof obj !== 'object' || obj === null) return [];
        return Object.entries(obj as Record<string, unknown>).map(([key, value]) => ({ key, value }));
    }

    isObject(value: unknown): boolean {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }

    formatLabel(key: string): string {
        return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }

    formatAny(value: unknown): string {
        if (value === null || value === undefined) return '—';
        if (typeof value === 'number') {
            return Number.isInteger(value) ? value.toLocaleString('pt-BR') : value.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
        }
        return String(value);
    }

    copyValue(entry: MetadataEntry) {
        const text = entry.type === 'json' ? JSON.stringify(entry.value, null, 2) : String(entry.value);
        this.clipboard.copyToClipboard(text, entry.label);
    }
}
