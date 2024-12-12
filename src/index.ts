import { DiscordMonitor } from './services/discord-monitor';
import { MemecoinAnalyzer } from './services/memecoin-analyzer';
import { ImageAnalyzer } from './services/image-analyzer';
import { logger } from './utils/logger';

async function main() {
    const discordMonitor = new DiscordMonitor();
    const memecoinAnalyzer = new MemecoinAnalyzer();
    const imageAnalyzer = new ImageAnalyzer();

    try {
        // Initialize services
        await memecoinAnalyzer.initialize();
        await discordMonitor.connectToExistingBrowser(config.discord.debugPort);

        // Start monitoring
        await discordMonitor.monitorMessages(async (discordMessage) => {
            try {
                // Extract tweet data from discord message
                const tweetData = {
                    id: discordMessage.tweetUrl.split('/').pop() || '',
                    content: discordMessage.content,
                    author: '', // Extract from tweet scraping
                    url: discordMessage.tweetUrl,
                    engagement: {
                        likes: 0,
                        retweets: 0,
                        replies: 0
                    }
                };

                // Analyze any images in the tweet
                let imageAnalysis;
                if (tweetData.mediaUrls && tweetData.mediaUrls.length > 0) {
                    imageAnalysis = await imageAnalyzer.analyzeImage(tweetData.mediaUrls[0]);
                }

                // Analyze for memecoin opportunities
                const analysis = await memecoinAnalyzer.analyzeTweetForMemecoins(
                    tweetData,
                    imageAnalysis
                );

                logger.info('Analysis complete:', {
                    tweetUrl: discordMessage.tweetUrl,
                    identifiedCoins: analysis.analysis.memecoinDetection.identifiedCoins,
                    confidence: analysis.analysis.memecoinDetection.confidenceScore
                });

            } catch (error) {
                logger.error('Error processing discord message:', error);
            }
        });

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('Shutting down...');
            await discordMonitor.cleanup();
            await memecoinAnalyzer.cleanup();
            process.exit(0);
        });

    } catch (error) {
        logger.error('Application startup error:', error);
        process.exit(1);
    }
}

main();