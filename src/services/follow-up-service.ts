import { MongoClient, Collection } from 'mongodb';
import { FollowUpAnalysis } from '../types';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { VipTracker } from './vip-tracker';
import { HistoricalPatternAnalyzer } from './historical-pattern-analyzer';

export class FollowUpService {
    private collection: Collection<FollowUpAnalysis>;
    private vipTracker: VipTracker;
    private historicalAnalyzer: HistoricalPatternAnalyzer;
    private checkInterval: NodeJS.Timer | null = null;

    constructor(
        private mongoClient: MongoClient,
        vipTracker: VipTracker,
        historicalAnalyzer: HistoricalPatternAnalyzer
    ) {
        this.collection = this.mongoClient
            .db(config.mongodb.dbName)
            .collection<FollowUpAnalysis>(config.mongodb.collections.followUps);
        this.vipTracker = vipTracker;
        this.historicalAnalyzer = historicalAnalyzer;
    }

    async initialize(): Promise<void> {
        // Create indexes for efficient querying
        await this.collection.createIndex({ scheduledTime: 1 });
        await this.collection.createIndex({ completed: 1 });
        await this.collection.createIndex({ tweetId: 1 });
        
        // Start checking for follow-ups
        this.startChecking();
        logger.info('FollowUpService initialized');
    }

    async scheduleFollowUp(
        tweetId: string,
        coins: string[],
        author: string
    ): Promise<void> {
        try {
            // Check if follow-up already exists
            const existing = await this.collection.findOne({ tweetId });
            if (existing) {
                logger.debug('Follow-up already scheduled for tweet:', tweetId);
                return;
            }

            const scheduledTime = new Date(Date.now() + config.analysis.followUp.scheduleDuration);
            
            await this.collection.insertOne({
                tweetId,
                coins,
                author,
                scheduledTime,
                completed: false,
                attempts: 0,
                priceImpacts: []
            });

            logger.info('Scheduled follow-up analysis:', {
                tweetId,
                coins,
                scheduledTime
            });
        } catch (error) {
            logger.error('Error scheduling follow-up:', error);
            throw error;
        }
    }

    private startChecking(): void {
        // Clear any existing interval
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        this.checkInterval = setInterval(
            () => this.processDueFollowUps(),
            config.analysis.followUp.checkInterval
        );
    }

    private async processDueFollowUps(): Promise<void> {
        try {
            const dueFollowUps = await this.collection.find({
                scheduledTime: { $lte: new Date() },
                completed: false,
                attempts: { $lt: config.analysis.followUp.maxAttempts }
            }).toArray();

            logger.debug(`Processing ${dueFollowUps.length} due follow-ups`);

            for (const followUp of dueFollowUps) {
                await this.processFollowUp(followUp);
            }
        } catch (error) {
            logger.error('Error processing follow-ups:', error);
        }
    }

    private async processFollowUp(followUp: FollowUpAnalysis): Promise<void> {
        try {
            // Update attempt count
            await this.collection.updateOne(
                { _id: followUp._id },
                { 
                    $inc: { attempts: 1 },
                    $set: { lastAttempted: new Date() }
                }
            );

            const priceImpacts: Array<{coin: string; impact: number; timestamp: Date}> = [];
            let significantImpactFound = false;

            // Process each coin
            for (const coin of followUp.coins) {
                const priceImpact = await this.historicalAnalyzer.calculatePriceImpact(
                    coin,
                    new Date(followUp.scheduledTime)
                );

                if (priceImpact !== null) {
                    priceImpacts.push({
                        coin,
                        impact: priceImpact,
                        timestamp: new Date()
                    });

                    // Update VIP influence score for significant impacts
                    if (Math.abs(priceImpact) >= config.analysis.followUp.minImpactThreshold) {
                        significantImpactFound = true;
                        await this.vipTracker.updateInfluenceScore(
                            followUp.author,
                            coin,
                            priceImpact
                        );

                        logger.info('Significant price impact detected:', {
                            tweetId: followUp.tweetId,
                            coin,
                            priceImpact,
                            author: followUp.author
                        });
                    }
                }
            }

            // Mark as completed if we found significant impacts or reached max attempts
            const shouldComplete = significantImpactFound || 
                followUp.attempts >= config.analysis.followUp.maxAttempts;

            if (shouldComplete) {
                await this.collection.updateOne(
                    { _id: followUp._id },
                    { 
                        $set: { 
                            completed: true,
                            priceImpacts
                        }
                    }
                );

                logger.info('Follow-up analysis completed:', {
                    tweetId: followUp.tweetId,
                    attempts: followUp.attempts,
                    significantImpactFound
                });
            } else {
                // Update price impacts but keep tracking
                await this.collection.updateOne(
                    { _id: followUp._id },
                    { $set: { priceImpacts } }
                );
            }

        } catch (error) {
            logger.error('Error processing follow-up:', {
                followUpId: followUp._id,
                tweetId: followUp.tweetId,
                error
            });
        }
    }

    async getFollowUpStatus(tweetId: string): Promise<FollowUpAnalysis | null> {
        return await this.collection.findOne({ tweetId });
    }

    async cleanup(): Promise<void> {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }

        // Clean up old completed follow-ups (optional)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        try {
            await this.collection.deleteMany({
                completed: true,
                scheduledTime: { $lt: thirtyDaysAgo }
            });
        } catch (error) {
            logger.error('Error cleaning up old follow-ups:', error);
        }
    }
}