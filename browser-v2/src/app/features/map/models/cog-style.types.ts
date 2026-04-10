/** Informação de banda derivada de eo:bands do STAC */
export interface BandInfo {
    index: number; // 1-based — OL usa ['band', N]
    name: string;
    commonName?: string;
}

/** Entrada de classificação derivada de classification:classes do STAC */
export interface ClassificationEntry {
    value: number;
    label: string;
    color: string; // hex: "#D32F2F" ou "#00000000" (8 chars com alfa)
}

export type RenderMode = 'singleband' | 'rgb' | 'classified';

export type ColorRampId = 'grayscale' | 'viridis' | 'inferno' | 'rdylgn' | 'ndvi' | 'blues';

export interface CogStyleConfig {
    renderMode: RenderMode;
    // Singleband
    selectedBand: number; // 1-based
    colorRamp: ColorRampId;
    min: number;
    max: number;
    // RGB composite
    redBand: number;
    greenBand: number;
    blueBand: number;
    // Classified
    classificationClasses?: ClassificationEntry[];
    // Ajustes globais
    opacity: number; // 0–1
    exposure: number; // -1 a 1
    contrast: number; // -1 a 1
    saturation: number; // -1 a 1
}

/** Cria configuração padrão com base no número de bandas e classes de classificação opcionais */
export function createDefaultCogStyle(bandCount: number, classes?: ClassificationEntry[]): CogStyleConfig {
    if (classes?.length) {
        const values = classes.map(c => c.value);
        return {
            renderMode: 'classified',
            selectedBand: 1,
            colorRamp: 'viridis',
            min: Math.min(...values),
            max: Math.max(...values),
            redBand: 1,
            greenBand: Math.min(2, bandCount),
            blueBand: Math.min(3, bandCount),
            classificationClasses: classes,
            opacity: 1,
            exposure: 0,
            contrast: 0,
            saturation: 0
        };
    }

    const isRgb = bandCount >= 3;
    return {
        renderMode: isRgb ? 'rgb' : 'singleband',
        selectedBand: 1,
        colorRamp: 'viridis',
        min: 0,
        max: 1,
        redBand: 1,
        greenBand: Math.min(2, bandCount),
        blueBand: Math.min(3, bandCount),
        opacity: 1,
        exposure: 0,
        contrast: 0,
        saturation: 0
    };
}
