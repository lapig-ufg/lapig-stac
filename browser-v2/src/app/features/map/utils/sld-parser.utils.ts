import type { ClassificationEntry } from '../models/cog-style.types';

/**
 * Parser focado para SLD com RasterSymbolizer + ColorMap type="values".
 * Extrai entradas de classificação (valor, rótulo, cor) de ColorMapEntry.
 */
export function parseSldToClassification(sldXml: string): ClassificationEntry[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(sldXml, 'application/xml');
    const entries: ClassificationEntry[] = [];

    const colorMapEntries = doc.getElementsByTagName('ColorMapEntry');
    for (let i = 0; i < colorMapEntries.length; i++) {
        const el = colorMapEntries[i];
        const color = el.getAttribute('color') ?? '#000000';
        const quantity = parseFloat(el.getAttribute('quantity') ?? '0');
        const label = el.getAttribute('label') ?? `Classe ${quantity}`;
        const opacity = parseFloat(el.getAttribute('opacity') ?? '1');

        // Converter cor + opacidade para formato hex com alfa
        let finalColor = color;
        if (opacity === 0) {
            finalColor = '#00000000';
        } else if (color.length === 9) {
            // Já tem alfa (#RRGGBBAA)
            finalColor = color;
        }

        entries.push({ value: quantity, label, color: finalColor });
    }

    return entries;
}
