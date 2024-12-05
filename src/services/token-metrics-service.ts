import { PriceVolumeData } from '../types';
import { PriceTracker } from './price-tracker';
import { logger } from '../utils/logger';

interface ITokenDataProvider {
    getTokenMetrics(tokenAddress: string): Promise<PriceVolumeData | null>;
}

// Stub for PumpFun service
export class PumpFunProvider implements ITokenDataProvider {
    async getTokenMetrics(tokenAddress: string): Promise<PriceVolumeData | null> {
        // TODO: Implement PumpFun IDL integration
        logger.info('PumpFun metrics requested for:', tokenAddress);
        return null;
    }
}

// Wrapper service that tries multiple data sources
export class TokenMetricsService {
    private dexScreener: PriceTracker;
    private pumpFun: PumpFunProvider;

    constructor() {
        this.dexScreener = new PriceTracker();
        this.pumpFun = new PumpFunProvider();
    }

    async getTokenMetrics(tokenAddress: string): Promise<PriceVolumeData | null> {
        // Try DexScreener first
        const dexScreenerData = await this.dexScreener.getTokenMetrics(tokenAddress);
        if (dexScreenerData) {
            return dexScreenerData;
        }

        // If not found on DexScreener, try PumpFun
        logger.info('Token not found on DexScreener, trying PumpFun:', tokenAddress);
        return await this.pumpFun.getTokenMetrics(tokenAddress);
    }
}