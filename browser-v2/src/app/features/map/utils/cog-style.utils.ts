import type { CogStyleConfig, ColorRampId, ClassificationEntry } from '../models/cog-style.types';

/**
 * Cada rampa é um array de stops: [valorNormalizado, r, g, b, a]
 * Os valores r/g/b estão em 0-255, a em 0-1.
 */
type ColorStop = [number, number, number, number, number];

export const COLOR_RAMPS: Record<ColorRampId, ColorStop[]> = {
    grayscale: [
        [0, 0, 0, 0, 1],
        [1, 255, 255, 255, 1]
    ],
    viridis: [
        [0, 68, 1, 84, 1],
        [0.25, 59, 82, 139, 1],
        [0.5, 33, 145, 140, 1],
        [0.75, 94, 201, 98, 1],
        [1, 253, 231, 37, 1]
    ],
    inferno: [
        [0, 0, 0, 4, 1],
        [0.25, 87, 16, 110, 1],
        [0.5, 188, 55, 84, 1],
        [0.75, 249, 142, 9, 1],
        [1, 252, 255, 164, 1]
    ],
    rdylgn: [
        [0, 215, 48, 39, 1],
        [0.25, 253, 174, 97, 1],
        [0.5, 255, 255, 191, 1],
        [0.75, 166, 217, 106, 1],
        [1, 26, 150, 65, 1]
    ],
    ndvi: [
        [0, 120, 69, 33, 1],
        [0.2, 189, 153, 99, 1],
        [0.4, 230, 220, 150, 1],
        [0.6, 160, 200, 80, 1],
        [0.8, 80, 160, 50, 1],
        [1, 20, 100, 20, 1]
    ],
    blues: [
        [0, 247, 251, 255, 1],
        [0.25, 198, 219, 239, 1],
        [0.5, 107, 174, 214, 1],
        [0.75, 33, 113, 181, 1],
        [1, 8, 48, 107, 1]
    ]
};

/** Rótulos legíveis para cada rampa */
export const COLOR_RAMP_LABELS: Record<ColorRampId, string> = {
    grayscale: 'Escala de cinza',
    viridis: 'Viridis',
    inferno: 'Inferno',
    rdylgn: 'Vermelho-Amarelo-Verde',
    ndvi: 'NDVI',
    blues: 'Azuis'
};

/** Gera string CSS linear-gradient para preview de uma rampa */
export function rampToGradient(rampId: ColorRampId): string {
    const stops = COLOR_RAMPS[rampId];
    const cssStops = stops
        .map(([pos, r, g, b]) => `rgb(${r},${g},${b}) ${pos * 100}%`)
        .join(', ');
    return `linear-gradient(90deg, ${cssStops})`;
}

/**
 * Converte cor hexadecimal (#RRGGBB ou #RRGGBBAA) para floats normalizados [r, g, b, a].
 */
export function parseHexColor(hex: string): [number, number, number, number] {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    const a = clean.length >= 8 ? parseInt(clean.substring(6, 8), 16) / 255 : 1;
    return [r, g, b, a];
}

/**
 * Gera expressão WebGL `case` para raster classificado.
 *
 * Usa comparações por faixa (value ± 0.5) em vez de igualdade exata para
 * ser robusto contra interpolação bilinear de textura e imprecisão Float32.
 * Classes são ordenadas por valor para que faixas menores sejam testadas primeiro.
 */
export function buildClassifiedStyle(classes: ClassificationEntry[], band: number): unknown[] {
    // Ordenar classes por valor para garantir faixas corretas
    const sorted = [...classes].sort((a, b) => a.value - b.value);

    const caseExpr: unknown[] = ['case'];
    for (const entry of sorted) {
        const [r, g, b, a] = parseHexColor(entry.color);
        if (a === 0) {
            // Nodata/transparente: tudo abaixo de value + 0.5
            caseExpr.push(['<', ['band', band], entry.value + 0.5]);
            caseExpr.push([0, 0, 0, 0]);
        } else {
            // Classe válida: value - 0.5 a value + 0.5 (usando <= progressivo)
            caseExpr.push(['<', ['band', band], entry.value + 0.5]);
            caseExpr.push([r, g, b, a]);
        }
    }
    // Fallback — transparente para valores acima do range
    caseExpr.push([0, 0, 0, 0]);
    return caseExpr;
}

/**
 * Constrói o objeto `style` para WebGLTileLayer a partir da configuração.
 *
 * O nodata é tratado diretamente nas expressões de estilo (sem banda alfa do source).
 * Retorna um objeto compatível com ol/layer/WebGLTile `style` option.
 */
export function buildCogStyle(config: CogStyleConfig): Record<string, unknown> {
    const { exposure, contrast, saturation } = config;

    if (config.renderMode === 'classified' && config.classificationClasses?.length) {
        return {
            color: buildClassifiedStyle(config.classificationClasses, config.selectedBand)
        };
    }

    if (config.renderMode === 'rgb') {
        return {
            variables: { exposure, contrast, saturation },
            exposure: ['var', 'exposure'],
            contrast: ['var', 'contrast'],
            saturation: ['var', 'saturation'],
            color: [
                'array',
                ['band', config.redBand],
                ['band', config.greenBand],
                ['band', config.blueBand],
                1
            ]
        };
    }

    // Singleband — interpola a banda selecionada entre min e max usando a rampa de cor
    const stops = COLOR_RAMPS[config.colorRamp];
    const band = config.selectedBand;
    const { min, max } = config;
    const range = max - min || 1; // evitar divisão por zero

    // Normaliza o valor da banda para 0–1 e interpola as cores
    const normalized: unknown[] = ['/', ['-', ['band', band], min], range];

    // Constrói a expressão de interpolação
    const interpolateArgs: unknown[] = ['interpolate', ['linear'], normalized];
    for (const [stopVal, r, g, b, a] of stops) {
        interpolateArgs.push(stopVal);
        interpolateArgs.push([r / 255, g / 255, b / 255, a]);
    }

    return {
        variables: { exposure, contrast, saturation },
        exposure: ['var', 'exposure'],
        contrast: ['var', 'contrast'],
        saturation: ['var', 'saturation'],
        color: interpolateArgs
    };
}
