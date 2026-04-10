import { FilesizePipe } from './filesize.pipe';

describe('FilesizePipe', () => {
    let pipe: FilesizePipe;

    beforeEach(() => {
        pipe = new FilesizePipe();
    });

    it('should return "—" for null', () => {
        expect(pipe.transform(null)).toBe('—');
    });

    it('should return "—" for undefined', () => {
        expect(pipe.transform(undefined)).toBe('—');
    });

    it('should return "—" for 0', () => {
        expect(pipe.transform(0)).toBe('—');
    });

    it('should return "—" for negative values', () => {
        expect(pipe.transform(-100)).toBe('—');
    });

    it('should format bytes', () => {
        expect(pipe.transform(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
        expect(pipe.transform(1024)).toBe('1.0 KB');
    });

    it('should format megabytes', () => {
        const mb = 245 * 1024 * 1024;
        expect(pipe.transform(mb)).toBe('245 MB');
    });

    it('should format gigabytes', () => {
        const gb = 1.5 * 1024 * 1024 * 1024;
        expect(pipe.transform(gb)).toBe('1.5 GB');
    });

    it('should format small KB with one decimal', () => {
        expect(pipe.transform(5120)).toBe('5.0 KB');
    });

    it('should round large values without decimals', () => {
        const largeMb = 234 * 1024 * 1024;
        expect(pipe.transform(largeMb)).toBe('234 MB');
    });
});
