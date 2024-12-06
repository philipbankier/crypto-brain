import dotenv from 'dotenv';
dotenv.config();

export const config = {
    discord: {
        channelUrl: process.env.DISCORD_CHANNEL_URL || '',
        debugPort: parseInt(process.env.CHROME_DEBUG_PORT || '9222'),
        selectors: {
            message: process.env.DISCORD_MESSAGE_SELECTOR || '.message-2qnXI6',
            messageContent: process.env.DISCORD_CONTENT_SELECTOR || '.markup-2BOw-j',
            loginButton: '[class*="loginButton-"]'
        },
        retryDelay: 5000, // 5 seconds between retries
    },
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
        dbName: 'memecoinMonitor',
        collections: {
            tweets: 'tweets',
            vipAccounts: 'vipAccounts',
            followUps: 'followUps'  // Add this line
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
        },
        followUp: {
            maxAttempts: 3,
            checkInterval: 5 * 60 * 1000, // Check every 5 minutes
            scheduleDuration: 48 * 60 * 60 * 1000 // 48 hours
        }
    },
    scraping: {
        retryAttempts: 3,
        retryDelay: 1000,
    }
};