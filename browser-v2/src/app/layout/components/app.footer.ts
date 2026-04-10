import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DividerModule } from 'primeng/divider';
import { TranslatePipe } from '@ngx-translate/core';
import { LayoutService } from '@/app/layout/service/layout.service';

@Component({
    selector: 'app-footer',
    standalone: true,
    imports: [CommonModule, DividerModule, TranslatePipe],
    styles: `
        .app-footer {
            border-top: 1px solid var(--p-content-border-color, var(--surface-border));
            background: var(--surface-card);
            color: var(--text-color);
            margin-top: 2rem;
        }
        .footer-main {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 2rem;
            padding: 2rem 2rem 1.5rem;
            max-width: 1200px;
        }
        .footer-brand {
            display: flex;
            align-items: flex-start;
            gap: 1rem;
        }
        .footer-brand img {
            height: 48px;
            width: auto;
        }
        .footer-brand-text h3 {
            font-family: var(--font-display, 'Exo 2', sans-serif);
            font-weight: 800;
            font-size: 1.1rem;
            letter-spacing: -0.02em;
            margin: 0;
        }
        .footer-brand-text p {
            font-size: 0.8rem;
            color: var(--text-color-secondary);
            margin: 0.25rem 0 0;
            line-height: 1.4;
        }
        .footer-section h4 {
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
            font-size: 0.7rem;
            font-weight: 600;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--text-color-secondary);
            margin: 0 0 1rem;
        }
        .footer-links {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 0.6rem;
        }
        .footer-links a {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--text-color);
            text-decoration: none;
            font-size: 0.85rem;
            transition: color 150ms ease;
        }
        .footer-links a:hover {
            color: var(--p-primary-color);
        }
        .footer-links a i {
            font-size: 0.9rem;
            width: 1.2rem;
            color: var(--text-color-secondary);
        }
        .footer-partners {
            display: flex;
            flex-wrap: nowrap;
            gap: 1.5rem;
            align-items: center;
        }
        .footer-partners a {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 44px;
        }
        .footer-partners img {
            max-height: 36px;
            max-width: 160px;
            width: auto;
            object-fit: contain;
            opacity: 0.65;
            transition: opacity 150ms ease;
            filter: grayscale(20%);
        }
        .footer-partners img:hover {
            opacity: 1;
            filter: grayscale(0%);
        }
        .footer-bottom {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem 2rem;
            border-top: 1px solid var(--p-content-border-color, var(--surface-border));
            font-size: 0.78rem;
            color: var(--text-color-secondary);
        }
        .footer-bottom-links {
            display: flex;
            gap: 0.5rem;
            align-items: center;
        }
        .footer-bottom-links a {
            color: var(--text-color-secondary);
            text-decoration: none;
            transition: color 150ms ease;
        }
        .footer-bottom-links a:hover {
            color: var(--p-primary-color);
        }
        @media (max-width: 767px) {
            .footer-main {
                grid-template-columns: 1fr;
                gap: 1.5rem;
            }
            .footer-bottom {
                flex-direction: column;
                gap: 0.5rem;
                text-align: center;
            }
        }
    `,
    template: `
        <footer class="app-footer">
            <div class="footer-main">
                <!-- Marca -->
                <div class="footer-brand">
                    <img [src]="layoutService.isDarkTheme() ? '/layout/images/lapig-stac-icone-claro-48.png' : '/layout/images/lapig-stac-icone.png'" alt="LAPIG" />
                    <div class="footer-brand-text">
                        <h3>{{ 'footer.title' | translate }}</h3>
                        <p>{{ 'footer.subtitle1' | translate }}<br>{{ 'footer.subtitle2' | translate }}<br>{{ 'footer.subtitle3' | translate }}</p>
                    </div>
                </div>

                <!-- Links úteis -->
                <div class="footer-section">
                    <h4>{{ 'footer.usefulLinks' | translate }}</h4>
                    <ul class="footer-links">
                        <li>
                            <a href="https://www.lapig.iesa.ufg.br" target="_blank" rel="noopener">
                                <i class="pi pi-globe"></i> {{ 'footer.portalLapig' | translate }}
                            </a>
                        </li>
                        <li>
                            <a href="https://github.com/lapig-ufg" target="_blank" rel="noopener">
                                <i class="pi pi-github"></i> {{ 'footer.githubRepo' | translate }}
                            </a>
                        </li>
                        <li>
                            <a href="/api/" target="_blank">
                                <i class="pi pi-server"></i> {{ 'footer.stacApi' | translate }}
                            </a>
                        </li>
                    </ul>
                </div>

                <!-- Parceiros -->
                <div class="footer-section">
                    <h4>{{ 'footer.partners' | translate }}</h4>
                    <div class="footer-partners">
                        <a href="https://opengeohub.org" target="_blank" rel="noopener" title="OpenGeoHub">
                            <img src="assets/images/logo-opengeohub.png" alt="OpenGeoHub" />
                        </a>
                        <a href="https://mapbiomas.org" target="_blank" rel="noopener" title="MapBiomas">
                            <img src="assets/images/logo-mapbiomas.png" alt="MapBiomas" />
                        </a>
                        <a href="https://www.lapig.iesa.ufg.br" target="_blank" rel="noopener" title="LAPIG">
                            <img src="assets/images/logo-lapig.png" alt="LAPIG" />
                        </a>
                        <a href="https://ufg.br" target="_blank" rel="noopener" title="Universidade Federal de Goiás">
                            <img src="assets/images/logo-ufg.png" alt="UFG" />
                        </a>
                    </div>
                </div>
            </div>

            <!-- Bottom bar -->
            <div class="footer-bottom">
                <span>&copy; {{ currentYear }} LAPIG/UFG. {{ 'footer.allRights' | translate }}</span>
                <div class="footer-bottom-links">
                    <a href="https://www.lapig.iesa.ufg.br" target="_blank" rel="noopener">{{ 'footer.termsOfUse' | translate }}</a>
                    <span>&bull;</span>
                    <a href="https://www.lapig.iesa.ufg.br" target="_blank" rel="noopener">{{ 'footer.privacyPolicy' | translate }}</a>
                </div>
            </div>
        </footer>
    `
})
export class AppFooter {
    layoutService = inject(LayoutService);
    currentYear = new Date().getFullYear();
}
