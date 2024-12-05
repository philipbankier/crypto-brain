import axios from 'axios';
import { PriceVolumeData } from '../types';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export class PriceTracker {
    private readonly DEXSCREENER_API = 'https://api.dexscreener.com/latest';
    private cache: Map<string, {
        data: PriceVolumeData,
        timestamp: number
    }> = new Map();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 1000; // 1 second

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async fetchWithRetry(url: string, retries = this.MAX_RETRIES): Promise<any> {
        try {
            const response = await axios.get(url);
            return response.data;
        } catch (error) {
            if (retries > 0 && error.response?.status >= 500) {
                await this.delay(this.RETRY_DELAY);
                return this.fetchWithRetry(url, retries - 1);
            }
            throw error;
        }
    }

    async getTokenMetrics(tokenAddress: string): Promise<PriceVolumeData | null> {
        try {
            // Check cache first
            const cached = this.cache.get(tokenAddress);
            if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
                return cached.data;
            }

            const data = await this.fetchWithRetry(
                `${this.DEXSCREENER_API}/dex/tokens/${tokenAddress}`
            );

            if (!data.pairs || data.pairs.length === 0) {
                logger.warn(`No pairs found for token: ${tokenAddress}`);
                return null;
            }

            // Get the most liquid pair
            const pair = data.pairs.sort((a: any, b: any) => 
                parseFloat(b.liquidity?.usd || '0') - parseFloat(a.liquidity?.usd || '0')
            )[0];

            const metrics: PriceVolumeData = {
                price: parseFloat(pair.priceUsd || '0'),
                volume24h: parseFloat(pair.volume?.h24 || '0'),
                marketCap: parseFloat(pair.fdv || '0'),
                timestamp: new Date()
            };

            // Cache the result
            this.cache.set(tokenAddress, {
                data: metrics,
                timestamp: Date.now()
            });

            return metrics;

        } catch (error) {
            logger.error('Error fetching token metrics:', error);
            return null;
        }
    }

    async getHistoricalMetrics(
        tokenAddress: string,
        timestamp: Date
    ): Promise<PriceVolumeData | null> {
        // Note: DexScreener doesn't provide historical data directly
        // This is a placeholder for future implementation
        logger.warn('Historical metrics not yet implemented');
        return this.getTokenMetrics(tokenAddress);
    }

    clearCache(): void {
        this.cache.clear();
    }
}