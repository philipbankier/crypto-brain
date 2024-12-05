import puppeteer from 'puppeteer';
import { config } from '../config/config';
import { DiscordMessage } from '../types';
import { logger } from '../utils/logger';

export class DiscordMonitor {
    private browser: puppeteer.Browser | null = null;
    private page: puppeteer.Page | null = null;
    private lastMessageId: string | null = null;

    async initialize(): Promise<void> {
        try {
            this.browser = await puppeteer.launch({ headless: "new" });
            this.page = await this.browser.newPage();
            await this.page.goto(config.discord.channelUrl, { waitUntil: 'networkidle2' });
            logger.info('Discord monitor initialized');
        } catch (error) {
            logger.error('Failed to initialize Discord monitor:', error);
            throw error;
        }
    }

    async monitorMessages(callback: (message: DiscordMessage) => Promise<void>): Promise<void> {
        if (!this.page) {
            throw new Error('Discord monitor not initialized');
        }

        setInterval(async () => {
            try {
                const messages = await this.page!.$$eval('.message-2qnXI6', nodes => nodes.map(n => ({
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
                        await callback({
                            messageId: message.messageId,
                            content: message.content,
                            timestamp: new Date(message.timestamp),
                            tweetUrl: message.tweetUrl
                        });
                    }
                }
            } catch (error) {
                logger.error('Error monitoring messages:', error);
            }
        }, 5000);
    }

    async cleanup(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            logger.info('Discord monitor cleaned up');
        }
    }
}