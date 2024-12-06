import { DiscordMonitor } from '../services/discord-monitor';
import { MemecoinAnalyzer } from '../services/memecoin-analyzer';
import { ImageAnalyzer } from '../services/image-analyzer';
import { logger } from '../utils/logger';

async function startMonitoring() {
    try {
        // Initialize services
        const monitor = new DiscordMonitor();
        const memecoinAnalyzer = new MemecoinAnalyzer();
        const imageAnalyzer = new ImageAnalyzer();

        // Initialize components
        await memecoinAnalyzer.initialize();
        
        // Connect to existing Chrome instance
        await monitor.connectToExistingBrowser(9222);
        logger.info('Successfully connected to Discord');

        // Start monitoring messages
        await monitor.monitorMessages(async (message) => {
            try {
                logger.info('New tweet detected:', message.tweetUrl);
                
                // Extract tweet data
                const tweetData = {
                    id: message.tweetUrl.split('/').pop() || '',
                    content: message.content,
                    author: '',  // Will be filled by tweet scraper
                    url: message.tweetUrl,
                    engagement: {
                        likes: 0,
                        retweets: 0,
                        replies: 0
                    },
                    mediaUrls: [],  // Will be filled by tweet scraper
                    timestamp: message.timestamp
                };

                // Process images if present
                let imageAnalysis;
                if (tweetData.mediaUrls?.length > 0) {
                    imageAnalysis = await imageAnalyzer.analyzeImage(tweetData.mediaUrls[0]);
                }

                // Analyze for memecoin opportunities
                const analysis = await memecoinAnalyzer.analyzeTweetForMemecoins(tweetData, imageAnalysis);

                logger.info('Analysis complete:', {
                    tweetUrl: message.tweetUrl,
                    identifiedCoins: analysis.analysis.memecoinDetection.identifiedCoins,
                    confidence: analysis.analysis.memecoinDetection.confidenceScore,
                    patterns: analysis.analysis.patterns
                });

            } catch (error) {
                logger.error('Error processing message:', error);
            }
        });

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('Shutting down...');
            await monitor.cleanup();
            await memecoinAnalyzer.cleanup();
            process.exit(0);
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

    } catch (error) {
        logger.error('Failed to start monitoring:', error);
        process.exit(1);
    }
}

// Start the monitoring
if (require.main === module) {
    startMonitoring().catch(error => {
        logger.error('Error in monitoring script:', error);
        process.exit(1);
    });
}