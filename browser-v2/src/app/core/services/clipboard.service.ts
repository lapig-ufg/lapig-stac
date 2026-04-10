import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

@Injectable({ providedIn: 'root' })
export class ClipboardService {
    private messageService = inject(MessageService);

    async copyToClipboard(text: string, label = 'URL') {
        try {
            await navigator.clipboard.writeText(text);
            this.messageService.add({
                severity: 'success',
                summary: 'Copiado!',
                detail: `${label} copiado para a área de transferência.`,
                life: 2000
            });
        } catch {
            this.messageService.add({
                severity: 'error',
                summary: 'Erro',
                detail: 'Não foi possível copiar para a área de transferência.',
                life: 3000
            });
        }
    }
}
