import { StacDatetimePipe } from './datetime.pipe';

describe('StacDatetimePipe', () => {
    let pipe: StacDatetimePipe;

    beforeEach(() => {
        pipe = new StacDatetimePipe();
    });

    it('should return "—" for null', () => {
        expect(pipe.transform(null)).toBe('—');
    });

    it('should return "—" for undefined', () => {
        expect(pipe.transform(undefined)).toBe('—');
    });

    it('should format ISO date in short format', () => {
        const result = pipe.transform('2024-03-15T10:30:00Z', 'short');
        expect(result).toBe('15 Mar 2024');
    });

    it('should format ISO date in full format', () => {
        const result = pipe.transform('2024-03-15T10:30:00Z', 'full');
        expect(result).toBe('15 Mar 2024 10:30 UTC');
    });

    it('should format interval "start/end"', () => {
        const result = pipe.transform('2020-01-01T00:00:00Z/2024-12-31T23:59:59Z');
        expect(result).toContain('1 Jan 2020');
        expect(result).toContain('31 Dez 2024');
        expect(result).toContain('–');
    });

    it('should handle open-ended interval "../end"', () => {
        const result = pipe.transform('../2024-12-31T23:59:59Z');
        expect(result).toContain('...');
        expect(result).toContain('31 Dez 2024');
    });

    it('should handle open-ended interval "start/.."', () => {
        const result = pipe.transform('2020-01-01T00:00:00Z/..');
        expect(result).toContain('1 Jan 2020');
        expect(result).toContain('presente');
    });

    it('should return raw string for invalid date', () => {
        const result = pipe.transform('not-a-date');
        expect(result).toBe('not-a-date');
    });

    it('should default to short format', () => {
        const result = pipe.transform('2024-06-20T00:00:00Z');
        expect(result).toBe('20 Jun 2024');
    });
});
