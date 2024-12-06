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
            tweets: 'tweets',
            vipAccounts: 'vipAccounts'
        }
    },
    neo4j: {
        uri: process.env.NEO4J_URI || 'neo4j://localhost:7687',
        user: process.env.NEO4J_USER || 'neo4j',
        password: process.env.NEO4J_PASSWORD || 'example'
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: {
            text: 'gpt-4',
            vision: 'gpt-4-vision-preview'
        }
    },
    analysis: {
        thresholds: {
            confidence: {
                high: 70,
                medium: 50,
                minimum: 30
            },
            engagement: {
                likes: 5000,
                retweets: 1000
            },
            momentum: {
                volume24h: 100000,  // $100k daily volume
                marketCap: 1000000  // $1M market cap
            }
        }
    },
    scraping: {
        retryAttempts: 3,
        retryDelay: 1000,
    }
};