import { MongoClient } from 'mongodb';
import { GraphService } from './graph-service';
import { TokenMetricsService } from './token-metrics-service';
import { config } from '../config/config';
import { logger } from '../utils/logger';

interface PatternStats {
    patternType: string;
    successRate: number;
    averageReturn: number;
    totalOccurrences: number;
    significantEvents: Array<{
        tweetId: string;
        memecoinName: string;
        priceImpact: number;
        timestamp: Date;
    }>;
}

export class HistoricalPatternAnalyzer {
    private mongoClient: MongoClient;
    private graphService: GraphService;
    private tokenMetrics: TokenMetricsService;

    constructor() {
        this.mongoClient = new MongoClient(config.mongodb.uri);
        this.graphService = new GraphService();
        this.tokenMetrics = new TokenMetricsService();
    }

    async initialize(): Promise<void> {
        await this.mongoClient.connect();
    }

    async analyzePatternSuccess(
        patternType: string,
        timeframeDays: number = 180
    ): Promise<PatternStats> {
        const collection = this.mongoClient
            .db(config.mongodb.dbName)
            .collection(config.mongodb.collections.tweets);

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - timeframeDays);

        const patterns = await collection.find({
            'analysis.patterns': patternType,
            'analysis.timestamp': { $gte: cutoffDate }
        }).toArray();

        let successfulEvents = 0;
        let totalReturn = 0;
        const significantEvents = [];

        for (const pattern of patterns) {
            for (const coin of pattern.analysis.memecoinDetection.identifiedCoins) {
                const priceImpact = await this.calculatePriceImpact(coin, pattern.analysis.timestamp);
                
                if (priceImpact > 20) { // 20% price increase threshold
                    successfulEvents++;
                    totalReturn += priceImpact;
                    
                    if (priceImpact > 50) { // 50% for significant events
                        significantEvents.push({
                            tweetId: pattern.tweetData.id,
                            memecoinName: coin,
                            priceImpact,
                            timestamp: pattern.analysis.timestamp
                        });
                    }
                }
            }
        }

        return {
            patternType,
            successRate: patterns.length > 0 ? successfulEvents / patterns.length : 0,
            averageReturn: successfulEvents > 0 ? totalReturn / successfulEvents : 0,
            totalOccurrences: patterns.length,
            significantEvents: significantEvents.sort((a, b) => b.priceImpact - a.priceImpact)
        };
    }

    private async calculatePriceImpact(
        coinName: string,
        timestamp: Date
    ): Promise<number> {
        try {
            // Get initial price
            const initialMetrics = await this.tokenMetrics.getTokenMetrics(coinName);
            if (!initialMetrics) return 0;

            // Get price after 24 hours
            const endTimestamp = new Date(timestamp);
            endTimestamp.setHours(endTimestamp.getHours() + 24);
            
            // For historical data, we might need to implement additional logic
            // to fetch prices at specific timestamps
            const finalMetrics = await this.tokenMetrics.getTokenMetrics(coinName);
            if (!finalMetrics) return 0;

            return ((finalMetrics.price - initialMetrics.price) / initialMetrics.price) * 100;
        } catch (error) {
            logger.error('Error calculating price impact:', error);
            return 0;
        }
    }

    async updatePatternConfidence(
        patternType: string,
        newConfidence: number
    ): Promise<void> {
        // Update pattern confidence based on historical success
        const stats = await this.analyzePatternSuccess(patternType);
        
        const adjustedConfidence = Math.min(
            100,
            newConfidence * (1 + stats.successRate)
        );

        return adjustedConfidence;
    }

    async cleanup(): Promise<void> {
        await this.mongoClient.close();
    }
}