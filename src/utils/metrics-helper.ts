// src/utils/metrics-helper.ts
export class MetricsHelper {
    static calculatePriceChange(initial: number, final: number): number {
        return ((final - initial) / initial) * 100;
    }

    static calculateMomentumScore(
        priceChange: number,
        volumeChange: number,
        marketCap: number
    ): number {
        const priceWeight = 0.4;
        const volumeWeight = 0.3;
        const mcapWeight = 0.3;

        const priceScore = Math.min(Math.max(priceChange, 0) / 100 * 100, 100);
        const volumeScore = Math.min(volumeChange / 1000000 * 100, 100);
        const mcapScore = Math.min(marketCap / 10000000 * 100, 100);

        return (
            priceScore * priceWeight +
            volumeScore * volumeWeight +
            mcapScore * mcapWeight
        );
    }
}