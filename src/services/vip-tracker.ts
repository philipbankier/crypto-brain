import { MongoClient } from 'mongodb';
import { VipAccount } from '../types';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export class VipTracker {
    private mongoClient: MongoClient;
    
    // Initial VIP list - will be enhanced by dynamic scoring
    private readonly INITIAL_VIPS = [
        {
            id: 'elonmusk',
            username: 'elonmusk',
            platform: 'twitter' as const,
            influenceScore: 100,
            memecoinsInfluenced: [],
            lastUpdated: new Date()
        }
    ];

    constructor() {
        this.mongoClient = new MongoClient(config.mongodb.uri);
    }

    async initialize(): Promise<void> {
        await this.mongoClient.connect();
        const collection = this.mongoClient
            .db(config.mongodb.dbName)
            .collection('vipAccounts');

        // Initialize with base VIPs if collection is empty
        const count = await collection.countDocuments();
        if (count === 0) {
            await collection.insertMany(this.INITIAL_VIPS);
        }
    }

    async isVip(username: string): Promise<boolean> {
        const collection = this.mongoClient
            .db(config.mongodb.dbName)
            .collection('vipAccounts');
            
        const account = await collection.findOne({ username: username.toLowerCase() });
        return !!account;
    }

    async updateInfluenceScore(
        username: string,
        memecoinName: string,
        priceImpact: number
    ): Promise<void> {
        const collection = this.mongoClient
            .db(config.mongodb.dbName)
            .collection('vipAccounts');

        const account = await collection.findOne({ username: username.toLowerCase() });
        if (!account) {
            // New influential account discovered
            await collection.insertOne({
                id: username.toLowerCase(),
                username: username.toLowerCase(),
                platform: 'twitter',
                influenceScore: 50, // Initial score for new VIPs
                memecoinsInfluenced: [memecoinName],
                lastUpdated: new Date()
            });
            return;
        }

        // Update existing VIP influence
        const newScore = Math.min(
            100,
            account.influenceScore + (priceImpact > 100 ? 10 : priceImpact > 50 ? 5 : 0)
        );

        await collection.updateOne(
            { username: username.toLowerCase() },
            {
                $set: { 
                    influenceScore: newScore,
                    lastUpdated: new Date()
                },
                $addToSet: { 
                    memecoinsInfluenced: memecoinName 
                }
            }
        );
    }

    async getVipInfo(username: string): Promise<VipAccount | null> {
        const collection = this.mongoClient
            .db(config.mongodb.dbName)
            .collection('vipAccounts');
            
        return await collection.findOne({ username: username.toLowerCase() });
    }

    async getTopInfluencers(limit: number = 10): Promise<VipAccount[]> {
        const collection = this.mongoClient
            .db(config.mongodb.dbName)
            .collection('vipAccounts');
            
        return await collection
            .find({})
            .sort({ influenceScore: -1 })
            .limit(limit)
            .toArray();
    }

    async cleanup(): Promise<void> {
        await this.mongoClient.close();
    }
}