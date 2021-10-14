export class math {
    static clamp(min, x, max) {
        return Math.max(min, Math.min(x, max))
    }
}