import { MongoClient } from 'mongodb';
import { 
    TweetData, 
    ImageAnalysis, 
    MemecoinAnalysis,
    MonitoredTweet,
    VipAccount 
} from '../types';
import { HybridPatternMatcher } from './hybrid-pattern-matcher';
import { TokenMetricsService } from './token-metrics-service';
import { GraphService } from './graph-service';
import { VipTracker } from './vip-tracker';
import { HistoricalPatternAnalyzer } from './historical-pattern-analyzer';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export class MemecoinAnalyzer {
    private patternMatcher: HybridPatternMatcher;
    private tokenMetrics: TokenMetricsService;
    private graphService: GraphService;
    private vipTracker: VipTracker;
    private historicalAnalyzer: HistoricalPatternAnalyzer;
    private mongoClient: MongoClient;

    constructor() {
        this.patternMatcher = new HybridPatternMatcher();
        this.tokenMetrics = new TokenMetricsService();
        this.graphService = new GraphService();
        this.vipTracker = new VipTracker();
        this.historicalAnalyzer = new HistoricalPatternAnalyzer();
        this.mongoClient = new MongoClient(config.mongodb.uri);
    }

    async initialize(): Promise<void> {
        await this.mongoClient.connect();
        await this.graphService.initializeSchema();
        await this.vipTracker.initialize();
        await this.historicalAnalyzer.initialize();
    }

    private async adjustConfidenceByVipStatus(
        confidence: number,
        author: string
    ): Promise<number> {
        const vipInfo = await this.vipTracker.getVipInfo(author);
        if (!vipInfo) return confidence;

        // Adjust confidence based on VIP's influence score
        const vipBoost = (vipInfo.influenceScore / 100) * 20; // Max 20% boost
        return Math.min(100, confidence + vipBoost);
    }

    private async adjustConfidenceByHistoricalSuccess(
        confidence: number,
        patterns: string[]
    ): Promise<number> {
        let adjustedConfidence = confidence;

        for (const pattern of patterns) {
            const stats = await this.historicalAnalyzer.analyzePatternSuccess(pattern);
            
            // Adjust confidence based on historical success rate
            const historicalBoost = stats.successRate * 15; // Max 15% boost
            adjustedConfidence = Math.min(100, adjustedConfidence + historicalBoost);
        }

        return adjustedConfidence;
    }

    async analyzeTweetForMemecoins(
        tweet: TweetData,
        imageAnalysis?: ImageAnalysis
    ): Promise<MonitoredTweet> {
        try {
            // 1. Pattern Analysis
            const patternAnalysis = await this.patternMatcher.analyzePattern(tweet, imageAnalysis);

            // 2. Adjust confidence based on VIP status
            let adjustedConfidence = await this.adjustConfidenceByVipStatus(
                patternAnalysis.confidence,
                tweet.author
            );

            // 3. Adjust confidence based on historical pattern success
            adjustedConfidence = await this.adjustConfidenceByHistoricalSuccess(
                adjustedConfidence,
                patternAnalysis.patterns
            );

            // 4. Check for existing memecoin relationships
            const existingRelations = await this.graphService.getRelatedEvents(
                patternAnalysis.suggestedCoins.join(',')
            );

            // 5. Get token metrics if available
            const metricsPromises = patternAnalysis.suggestedCoins.map(async (coin: string) => {
                const metrics = await this.tokenMetrics.getTokenMetrics(coin);
                return { coin, metrics };
            });

            const tokenMetrics = await Promise.all(metricsPromises);

            // 6. Create analysis result
            const analysisResult: MonitoredTweet = {
                discordMessage: {
                    messageId: tweet.id,
                    content: tweet.content,
                    timestamp: new Date(),
                    tweetUrl: tweet.url
                },
                tweetData: tweet,
                analysis: {
                    imageAnalysis,
                    memecoinDetection: {
                        identifiedCoins: patternAnalysis.suggestedCoins,
                        reasoning: patternAnalysis.reasoning,
                        confidenceScore: adjustedConfidence
                    },
                    patterns: patternAnalysis.patterns,
                    metrics: tokenMetrics.filter(tm => tm.metrics !== null),
                    existingRelations: existingRelations,
                    vipContext: await this.vipTracker.getVipInfo(tweet.author),
                    historicalContext: {
                        patternStats: await Promise.all(
                            patternAnalysis.patterns.map(p => 
                                this.historicalAnalyzer.analyzePatternSuccess(p)
                            )
                        )
                    },
                    timestamp: new Date()
                }
            };

            // 7. Update graph relationships
            await this.updateGraphRelationships(tweet, patternAnalysis);

            // 8. Store analysis
            await this.storeAnalysis(analysisResult);

            // 9. Schedule follow-up analysis for VIP tracking
            this.scheduleFollowUpAnalysis(tweet, patternAnalysis.suggestedCoins);

            // 10. Log high confidence signals
            if (adjustedConfidence >= config.analysis.thresholds.confidence.high) {
                logger.info('High confidence memecoin signal detected:', {
                    patterns: patternAnalysis.patterns,
                    coins: patternAnalysis.suggestedCoins,
                    confidence: adjustedConfidence,
                    vipAuthor: analysisResult.analysis.vipContext?.username,
                    tweetUrl: tweet.url
                });
            }

            return analysisResult;

        } catch (error) {
            logger.error('Error in memecoin analysis:', error);
            throw error;
        }
    }

    private async scheduleFollowUpAnalysis(
        tweet: TweetData,
        coins: string[]
    ): Promise<void> {
        // Schedule a follow-up analysis after 48 hours
        setTimeout(async () => {
            try {
                for (const coin of coins) {
                    const priceImpact = await this.historicalAnalyzer.calculatePriceImpact(
                        coin,
                        new Date(tweet.timestamp)
                    );

                    // Update VIP influence score based on price impact
                    await this.vipTracker.updateInfluenceScore(
                        tweet.author,
                        coin,
                        priceImpact
                    );
                }
            } catch (error) {
                logger.error('Error in follow-up analysis:', error);
            }
        }, 48 * 60 * 60 * 1000); // 48 hours
    }

    private async updateGraphRelationships(
        tweet: TweetData,
        patternAnalysis: any
    ): Promise<void> {
        try {
            // Create tweet node
            await this.graphService.createTweetNode({
                id: tweet.id,
                content: tweet.content,
                authorId: tweet.author,
                timestamp: new Date(),
                engagement: tweet.engagement
            });

            // Create event nodes for each pattern
            for (const pattern of patternAnalysis.patterns) {
                const eventId = `${pattern}_${tweet.id}`;
                await this.graphService.createEventNode({
                    id: eventId,
                    type: pattern,
                    initialTweetId: tweet.id,
                    status: 'active',
                    created: new Date(),
                    engagement: tweet.engagement
                });

                // Link event to suggested memecoins
                for (const coin of patternAnalysis.suggestedCoins) {
                    await this.graphService.linkEventToMemecoin(eventId, coin);
                }
            }
        } catch (error) {
            logger.error('Error updating graph relationships:', error);
        }
    }

    private async storeAnalysis(analysis: MonitoredTweet): Promise<void> {
        const collection = this.mongoClient
            .db(config.mongodb.dbName)
            .collection(config.mongodb.collections.tweets);

        await collection.insertOne(analysis);
    }

    async cleanup(): Promise<void> {
        await this.mongoClient.close();
        await this.graphService.cleanup();
    }
}