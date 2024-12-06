import puppeteer, { Browser, Page } from 'puppeteer';
import { config } from '../config/config';
import { DiscordMessage } from '../types';
import { logger } from '../utils/logger';

interface MonitorStatus {
    isConnected: boolean;
    lastMessageTimestamp: Date | null;
    errorCount: number;
    lastError: string | null;
}

export class DiscordMonitor {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private lastMessageId: string | null = null;
    private status: MonitorStatus = {
        isConnected: false,
        lastMessageTimestamp: null,
        errorCount: 0,
        lastError: null
    };
    private reconnectAttempts = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 5;

    async connectToExistingBrowser(): Promise<void> {
        try {
            // Connect to existing Chrome instance
            this.browser = await puppeteer.connect({
                browserURL: `http://localhost:${config.discord.debugPort}`,
                defaultViewport: null
            });

            // Get all pages
            const pages = await this.browser.pages();
            
            // Find Discord page
            this.page = await this.findDiscordPage(pages);
            
            if (!this.page) {
                throw new Error('No Discord page found. Please ensure Discord is open in Chrome.');
            }

            // Verify we're on the correct channel
            const currentUrl = await this.page.url();
            if (!currentUrl.includes('discord.com')) {
                throw new Error('Connected page is not Discord');
            }

            this.status.isConnected = true;
            this.reconnectAttempts = 0;
            logger.info('Successfully connected to existing Discord tab');

        } catch (error) {
            this.status.lastError = error.message;
            this.status.errorCount++;
            logger.error('Failed to connect to existing browser:', error);
            throw error;
        }
    }

    private async findDiscordPage(pages: Page[]): Promise<Page | null> {
        for (const page of pages) {
            try {
                const url = await page.url();
                if (url.includes('discord.com')) {
                    return page;
                }
            } catch (error) {
                logger.warn('Error checking page URL:', error);
                continue;
            }
        }
        return null;
    }

    private async verifyDiscordAuthentication(): Promise<boolean> {
        if (!this.page) return false;

        try {
            // Check for login button presence
            const loginButton = await this.page.$(config.discord.selectors.loginButton);
            if (loginButton) {
                throw new Error('Discord not logged in');
            }

            // Verify we can access messages
            const messages = await this.page.$$(config.discord.selectors.message);
            return messages.length > 0;

        } catch (error) {
            logger.error('Authentication verification failed:', error);
            return false;
        }
    }

    async monitorMessages(callback: (message: DiscordMessage) => Promise<void>): Promise<void> {
        if (!this.page) {
            throw new Error('Discord monitor not initialized');
        }

        // Initial authentication check
        const isAuthenticated = await this.verifyDiscordAuthentication();
        if (!isAuthenticated) {
            throw new Error('Discord authentication failed');
        }

        const checkMessages = async () => {
            try {
                if (!this.page) throw new Error('Page not available');

                // Attempt with primary selectors
                let messages = await this.extractMessages();
                
                // If no messages found, try alternative selectors
                if (!messages || messages.length === 0) {
                    logger.warn('Primary selectors failed, attempting alternatives');
                    messages = await this.extractMessagesWithAlternatives();
                }

                for (const message of messages) {
                    if (this.isNewTweetMessage(message)) {
                        this.lastMessageId = message.messageId;
                        this.status.lastMessageTimestamp = new Date();
                        
                        await callback({
                            messageId: message.messageId,
                            content: message.content,
                            timestamp: new Date(message.timestamp),
                            tweetUrl: message.tweetUrl
                        });
                    }
                }

                // Reset error count on successful check
                if (this.status.errorCount > 0) {
                    this.status.errorCount = 0;
                    this.status.lastError = null;
                }

            } catch (error) {
                this.handleMonitoringError(error);
            }
        };

        // Start monitoring loop
        setInterval(checkMessages, config.discord.retryDelay);

        // Add error event listeners
        this.page.on('error', this.handlePageError.bind(this));
        this.page.on('close', this.handlePageClose.bind(this));
    }

    private async extractMessages(): Promise<Array<any>> {
        return this.page!.$$eval(config.discord.selectors.message, (nodes, contentSelector) => 
            nodes.map(n => ({
                messageId: n.getAttribute('id') || '',
                content: n.querySelector(contentSelector)?.textContent || '',
                timestamp: new Date().toISOString(),
                tweetUrl: Array.from(n.querySelectorAll('a'))
                    .map(a => a.href)
                    .find(href => href.includes('twitter.com') || href.includes('x.com')) || ''
            })), config.discord.selectors.messageContent);
    }

    private async extractMessagesWithAlternatives(): Promise<Array<any>> {
        // Try common alternative Discord selectors
        const alternativeSelectors = [
            '.chatContent-*, .messageContent-*',
            '[class*="message-"]',
            '[class*="messageContent"]'
        ];

        for (const selector of alternativeSelectors) {
            try {
                const messages = await this.page!.$$eval(selector, nodes =>
                    nodes.map(n => ({
                        messageId: n.getAttribute('id') || '',
                        content: n.textContent || '',
                        timestamp: new Date().toISOString(),
                        tweetUrl: Array.from(n.querySelectorAll('a'))
                            .map(a => a.href)
                            .find(href => href.includes('twitter.com') || href.includes('x.com')) || ''
                    }))
                );
                
                if (messages.length > 0) {
                    logger.info(`Found messages using alternative selector: ${selector}`);
                    return messages;
                }
            } catch (error) {
                continue;
            }
        }

        return [];
    }

    private isNewTweetMessage(message: any): boolean {
        return message.messageId !== this.lastMessageId && 
               message.tweetUrl && 
               (message.tweetUrl.includes('twitter.com') || message.tweetUrl.includes('x.com'));
    }

    private async handleMonitoringError(error: Error): Promise<void> {
        this.status.errorCount++;
        this.status.lastError = error.message;
        logger.error('Error monitoring messages:', error);

        if (this.status.errorCount >= 3) {
            await this.attemptReconnection();
        }
    }

    private async attemptReconnection(): Promise<void> {
        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            throw new Error('Max reconnection attempts reached');
        }

        logger.info('Attempting to reconnect...');
        this.reconnectAttempts++;

        try {
            await this.cleanup();
            await this.connectToExistingBrowser();
            logger.info('Reconnection successful');
        } catch (error) {
            logger.error('Reconnection failed:', error);
            await new Promise(resolve => setTimeout(resolve, config.discord.retryDelay));
        }
    }

    private async handlePageError(error: Error): Promise<void> {
        logger.error('Page error occurred:', error);
        this.status.lastError = error.message;
        await this.attemptReconnection();
    }

    private async handlePageClose(): Promise<void> {
        logger.warn('Discord page was closed');
        await this.attemptReconnection();
    }

    getStatus(): MonitorStatus {
        return { ...this.status };
    }

    async cleanup(): Promise<void> {
        if (this.browser) {
            try {
                await this.browser.disconnect();
                this.browser = null;
                this.page = null;
                this.status.isConnected = false;
                logger.info('Discord monitor cleaned up');
            } catch (error) {
                logger.error('Error during cleanup:', error);
            }
        }
    }
}