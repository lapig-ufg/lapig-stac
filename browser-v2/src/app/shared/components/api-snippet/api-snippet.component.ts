import { Component, input, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { TooltipModule } from 'primeng/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { ClipboardService } from '@/app/core/services/clipboard.service';
import { environment } from '@/app/core/config/environment';

export type SnippetLanguage = 'python' | 'javascript' | 'curl' | 'gdal' | 'r';

interface SnippetDef {
    id: SnippetLanguage;
    label: string;
    icon: string;
    install?: string;
    code: string;
}

@Component({
    selector: 'app-api-snippet',
    standalone: true,
    imports: [CommonModule, ButtonModule, TabsModule, TooltipModule, TranslatePipe],
    styles: `
        .snippet-code {
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
            font-size: 0.8rem;
            line-height: 1.6;
            padding: 1rem;
            border-radius: 8px;
            background: var(--p-surface-100);
            color: var(--text-color);
            overflow-x: auto;
            white-space: pre;
            tab-size: 4;
            position: relative;
        }
        :root[class*='app-dark'] .snippet-code {
            background: var(--p-surface-800);
        }
        .snippet-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
        }
        .install-hint {
            font-family: var(--font-mono, monospace);
            font-size: 0.7rem;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            background: var(--p-content-hover-background);
            color: var(--text-color-secondary);
        }
    `,
    template: `
        <div>
            <div class="snippet-header">
                <span class="font-mono text-xs uppercase tracking-widest" style="color: var(--color-cerrado-gold, #C4933F); letter-spacing: 0.12em;">
                    {{ 'api.overline' | translate }}
                </span>
            </div>

            <p-tabs [value]="activeTab()">
                <p-tablist>
                    @for (snippet of snippets(); track snippet.id) {
                        <p-tab [value]="snippet.id" (click)="activeTab.set(snippet.id)">
                            {{ snippet.label }}
                        </p-tab>
                    }
                </p-tablist>
                <p-tabpanels>
                    @for (snippet of snippets(); track snippet.id) {
                        <p-tabpanel [value]="snippet.id">
                            @if (snippet.install) {
                                <div class="install-hint mb-2">
                                    {{ 'api.installHint' | translate }}: <strong>{{ snippet.install }}</strong>
                                </div>
                            }
                            <div class="relative">
                                <p-button
                                    [icon]="copiedTab() === snippet.id ? 'pi pi-check' : 'pi pi-copy'"
                                    [severity]="copiedTab() === snippet.id ? 'success' : 'secondary'"
                                    size="small"
                                    [rounded]="true"
                                    [text]="true"
                                    (onClick)="copySnippet(snippet)"
                                    [pTooltip]="copiedTab() === snippet.id ? ('api.copied' | translate) : ('metadata.copy' | translate)"
                                    tooltipPosition="left"
                                    [style]="{ position: 'absolute', top: '0.5rem', right: '0.5rem', 'z-index': '1' }"
                                />
                                <pre class="snippet-code">{{ snippet.code }}</pre>
                            </div>
                        </p-tabpanel>
                    }
                </p-tabpanels>
            </p-tabs>
        </div>
    `
})
export class ApiSnippetComponent {
    private clipboard = inject(ClipboardService);

    /** URL completa do item STAC */
    stacUrl = input.required<string>();
    collectionId = input.required<string>();
    itemId = input.required<string>();
    /** URL do primeiro asset COG (se existir) */
    cogUrl = input<string | null>(null);

    activeTab = signal<SnippetLanguage>('python');
    copiedTab = signal<SnippetLanguage | null>(null);

    private baseUrl = environment.stacApiUrl;

    snippets = computed<SnippetDef[]>(() => {
        const col = this.collectionId();
        const item = this.itemId();
        const base = this.baseUrl;
        const itemUrl = `${base}/collections/${col}/items/${item}`;
        const cog = this.cogUrl();

        return [
            {
                id: 'python',
                label: 'Python',
                icon: 'pi pi-code',
                install: 'pip install pystac-client',
                code: `from pystac_client import Client

catalog = Client.open("${base}")
collection = catalog.get_collection("${col}")

# Buscar item específico
item = collection.get_item("${item}")
print(item.properties)

# Listar assets
for key, asset in item.assets.items():
    print(f"{key}: {asset.href}")${cog ? `

# Abrir COG com rasterio
import rasterio
with rasterio.open("${cog}") as src:
    print(src.profile)` : ''}`
            },
            {
                id: 'javascript',
                label: 'JavaScript',
                icon: 'pi pi-code',
                code: `// Fetch item via STAC API
const response = await fetch("${itemUrl}");
const item = await response.json();

console.log(item.properties);

// Listar assets
for (const [key, asset] of Object.entries(item.assets)) {
    console.log(\`\${key}: \${asset.href}\`);
}`
            },
            {
                id: 'curl',
                label: 'cURL',
                icon: 'pi pi-server',
                code: `# Obter item
curl -s "${itemUrl}" | jq .

# Listar coleções
curl -s "${base}/collections" | jq '.collections[].id'

# Buscar items na coleção
curl -s "${base}/collections/${col}/items?limit=10" | jq '.features[].id'`
            },
            {
                id: 'gdal',
                label: 'GDAL',
                icon: 'pi pi-map',
                code: cog
                    ? `# Informações do COG
gdalinfo "${cog}"

# Converter para GeoTIFF local
gdal_translate "${cog}" output.tif

# Recortar por bbox (oeste, sul, leste, norte)
gdal_translate -projwin -50.0 -14.0 -48.0 -16.0 \\
    "${cog}" recorte.tif`
                    : `# Nenhum asset COG encontrado neste item.
# Use o endpoint da API para listar assets:
# ${itemUrl}`
            },
            {
                id: 'r',
                label: 'R',
                icon: 'pi pi-chart-bar',
                install: 'install.packages("rstac")',
                code: `library(rstac)

stac("${base}") |>
  collections("${col}") |>
  items("${item}") |>
  get_request() -> item

# Propriedades
item$properties

# Assets
lapply(item$assets, function(a) a$href)${cog ? `

# Ler COG com terra
library(terra)
r <- rast("${cog}")
plot(r)` : ''}`
            }
        ];
    });

    copySnippet(snippet: SnippetDef) {
        this.clipboard.copyToClipboard(snippet.code, `Snippet ${snippet.label}`);
        this.copiedTab.set(snippet.id);
        setTimeout(() => this.copiedTab.set(null), 2000);
    }
}
