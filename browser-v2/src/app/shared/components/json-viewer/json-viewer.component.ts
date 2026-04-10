import { Component, input, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ClipboardService } from '@/app/core/services/clipboard.service';

@Component({
    selector: 'app-json-viewer',
    standalone: true,
    imports: [CommonModule, ButtonModule, TooltipModule],
    styles: `
        .json-container {
            position: relative;
        }
        .json-code {
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
            font-size: 0.8rem;
            line-height: 1.6;
            padding: 1.25rem;
            border-radius: 8px;
            background: var(--p-surface-100);
            color: var(--text-color);
            overflow: auto;
            max-height: 600px;
            white-space: pre;
            tab-size: 2;
        }
        :root[class*='app-dark'] .json-code {
            background: var(--p-surface-800);
        }
        .copy-btn {
            position: absolute;
            top: 0.75rem;
            right: 0.75rem;
        }
    `,
    template: `
        <div class="json-container">
            <p-button
                [icon]="copied() ? 'pi pi-check' : 'pi pi-copy'"
                [label]="copied() ? 'Copiado!' : 'Copiar JSON'"
                [severity]="copied() ? 'success' : 'secondary'"
                size="small"
                class="copy-btn"
                (onClick)="copyJson()"
            />
            <pre class="json-code">{{ formattedJson() }}</pre>
        </div>
    `
})
export class JsonViewerComponent {
    private clipboard = inject(ClipboardService);

    data = input.required<unknown>();

    copied = signal(false);

    formattedJson = computed(() => {
        try {
            return JSON.stringify(this.data(), null, 2);
        } catch {
            return String(this.data());
        }
    });

    copyJson() {
        this.clipboard.copyToClipboard(this.formattedJson(), 'JSON');
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
    }
}
