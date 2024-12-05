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
    private readonly RECONNECT_DELAY = 5000;

    async connectToExistingBrowser(debugPort: number = 9222): Promise<void> {
        try {
            // Connect to existing Chrome instance
            this.browser = await puppeteer.connect({
                browserURL: `http://localhost:${debugPort}`,
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
            const loginButton = await this.page.$('[class*="loginButton-"]');
            if (loginButton) {
                throw new Error('Discord not logged in');
            }

            // Verify we can access messages
            const messages = await this.page.$$('.message-2qnXI6');
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

                const messages = await this.page.$$eval('.message-2qnXI6', nodes => nodes.map(n => ({
                    messageId: n.getAttribute('id') || '',
                    content: n.querySelector('.markup-2BOw-j')?.textContent || '',
                    timestamp: new Date().toISOString(),
                    tweetUrl: Array.from(n.querySelectorAll('a'))
                        .map(a => a.href)
                        .find(href => href.includes('twitter.com') || href.includes('x.com')) || ''
                })));

                for (const message of messages) {
                    if (
                        message.messageId !== this.lastMessageId && 
                        message.tweetUrl && 
                        (message.tweetUrl.includes('twitter.com') || message.tweetUrl.includes('x.com'))
                    ) {
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
                this.status.errorCount++;
                this.status.lastError = error.message;
                logger.error('Error monitoring messages:', error);

                // Attempt reconnection if needed
                if (this.status.errorCount >= 3) {
                    await this.attemptReconnection();
                }
            }
        };

        // Start monitoring loop
        setInterval(checkMessages, 5000);

        // Add error event listeners
        this.page.on('error', this.handlePageError.bind(this));
        this.page.on('close', this.handlePageClose.bind(this));
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
            await new Promise(resolve => setTimeout(resolve, this.RECONNECT_DELAY));
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