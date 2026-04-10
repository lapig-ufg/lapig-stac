import { TruncatePipe } from './truncate.pipe';

describe('TruncatePipe', () => {
    let pipe: TruncatePipe;

    beforeEach(() => {
        pipe = new TruncatePipe();
    });

    it('should return empty string for null', () => {
        expect(pipe.transform(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
        expect(pipe.transform(undefined)).toBe('');
    });

    it('should return original string if within limit', () => {
        expect(pipe.transform('short text', 100)).toBe('short text');
    });

    it('should truncate with ellipsis at maxLength', () => {
        const long = 'a'.repeat(150);
        const result = pipe.transform(long, 100);
        expect(result.length).toBeLessThanOrEqual(103); // 100 + '...'
        expect(result.endsWith('...')).toBeTrue();
    });

    it('should default to 100 characters', () => {
        const long = 'a'.repeat(150);
        const result = pipe.transform(long);
        expect(result.length).toBeLessThanOrEqual(103);
    });

    it('should handle exact length', () => {
        const exact = 'a'.repeat(100);
        expect(pipe.transform(exact, 100)).toBe(exact);
    });

    it('should handle empty string', () => {
        expect(pipe.transform('')).toBe('');
    });
});
