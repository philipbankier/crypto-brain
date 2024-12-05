import dotenv from 'dotenv';
dotenv.config();

export const config = {
    discord: {
        channelUrl: process.env.DISCORD_CHANNEL_URL || '',
    },
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
        dbName: 'memecoinMonitor',
        collections: {
            tweets: 'tweets'
        }
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: {
            text: 'gpt-4',
            vision: 'gpt-4-vision-preview'
        }
    },
    scraping: {
        retryAttempts: 3,
        retryDelay: 1000,
    }
};

// src/types/index.ts
export interface DiscordMessage {
    messageId: string;
    content: string;
    timestamp: Date;
    tweetUrl: string;
}

export interface TweetData {
    tweetId: string;
    author: string;
    content: string;
    mediaUrls: string[];
    engagement: {
        likes: number;
        retweets: number;
        replies: number;
    };
    parentTweetId?: string;
    conversationId?: string;
}

export interface ImageAnalysis {
    description: string;
    memecoinContext: string;
}

export interface MemecoinAnalysis {
    identifiedCoins: string[];
    reasoning: string;
    confidenceScore: number;
}

export interface MonitoredTweet {
    discordMessage: DiscordMessage;
    tweetData: TweetData;
    analysis: {
        imageAnalysis?: ImageAnalysis;
        memecoinDetection: MemecoinAnalysis;
        timestamp: Date;
    };
}