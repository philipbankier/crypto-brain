export interface DiscordMessage {
    messageId: string;
    content: string;
    timestamp: Date;
    tweetUrl: string;
}

export interface TweetData {
    id: string;                  // Standardized to 'id'
    content: string;
    author: string;
    url: string;
    engagement: {
        likes: number;
        retweets: number;
        replies: number;
    };
    mediaUrls?: string[];
    timestamp?: Date;
}

export interface ImageAnalysis {
    description: string;
    memecoinContext: string;
}

export interface MemecoinAnalysis {
    identifiedCoins: string[];
    reasoning: string;
    confidenceScore: number;
    patterns: string[];
    category: string;
}

export interface MonitoredTweet {
    discordMessage: DiscordMessage;
    tweetData: TweetData;
    analysis: {
        imageAnalysis?: ImageAnalysis;
        memecoinDetection: MemecoinAnalysis;
        patterns: string[];
        metrics: Array<{
            coin: string;
            metrics: PriceVolumeData | null;
        }>;
        existingRelations: any[];
        vipContext?: VipAccount;
        historicalContext?: {
            patternStats: any[];
        };
        timestamp: Date;
    };
}

export interface FollowUpAnalysis {
    tweetId: string;
    coins: string[];
    scheduledTime: Date;
    completed: boolean;
    attempts: number;
    lastAttempted?: Date;
}