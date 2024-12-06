import { Configuration, OpenAIApi } from 'openai';
import axios from 'axios';
import { ImageAnalysis } from '../types';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export class ImageAnalyzer {
    private openai: OpenAIApi;
    private cache: Map<string, { analysis: ImageAnalysis, timestamp: number }> = new Map();
    private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
    private lastRequestTime: number = 0;
    private readonly MIN_REQUEST_GAP = 1000; // 1 second minimum between requests

    constructor() {
        const configuration = new Configuration({
            apiKey: config.openai.apiKey,
        });
        this.openai = new OpenAIApi(configuration);
    }

    async analyzeImage(imageUrl: string): Promise<ImageAnalysis | null> {
        try {
            // Check cache first
            const cached = this.cache.get(imageUrl);
            if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
                logger.debug('Returning cached image analysis for:', imageUrl);
                return cached.analysis;
            }

            // Validate URL before processing
            const isValid = await this.validateImageUrl(imageUrl);
            if (!isValid) {
                logger.warn('Invalid or inaccessible image URL:', imageUrl);
                return null;
            }

            // Implement rate limiting
            await this.enforceRateLimit();

            const response = await this.openai.createChatCompletion({
                model: config.openai.model.vision,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Analyze this image in the context of cryptocurrency and memecoins. Focus on: 1) Any memes or cultural references 2) Connections to existing cryptocurrencies 3) Potential new memecoin opportunities. Provide a concise description and specific memecoin-related context."
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: imageUrl,
                                }
                            }
                        ],
                    }
                ],
                max_tokens: 300
            });

            const content = response.data.choices[0]?.message?.content;
            if (!content) {
                logger.warn('Empty response from OpenAI for image:', imageUrl);
                return null;
            }

            // Split content into description and memecoin context
            const [description, memecoinContext] = this.parseAnalysisContent(content);
            
            const analysis: ImageAnalysis = {
                description,
                memecoinContext
            };

            // Cache the result
            this.cache.set(imageUrl, {
                analysis,
                timestamp: Date.now()
            });

            return analysis;

        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 429) {
                logger.error('Rate limit exceeded for OpenAI API:', error);
            } else {
                logger.error('Error analyzing image:', error);
            }
            return null;
        }
    }

    private async validateImageUrl(url: string): Promise<boolean> {
        try {
            const response = await axios.head(url);
            
            // Check if it's an image
            const contentType = response.headers['content-type'];
            if (!contentType?.startsWith('image/')) {
                return false;
            }

            // Check file size (if available)
            const contentLength = response.headers['content-length'];
            if (contentLength && parseInt(contentLength) > 20 * 1024 * 1024) { // 20MB limit
                logger.warn('Image too large:', url);
                return false;
            }

            return true;
        } catch (error) {
            logger.error('Error validating image URL:', error);
            return false;
        }
    }

    private async enforceRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.MIN_REQUEST_GAP) {
            const delay = this.MIN_REQUEST_GAP - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        this.lastRequestTime = Date.now();
    }

    private parseAnalysisContent(content: string): [string, string] {
        const parts = content.split('\n\n');
        
        if (parts.length < 2) {
            return [
                content,
                'No specific memecoin context identified.'
            ];
        }

        // Find the most relevant parts for description and context
        const description = parts.find(p => 
            p.toLowerCase().includes('show') || 
            p.toLowerCase().includes('image') ||
            p.toLowerCase().includes('picture')
        ) || parts[0];

        const memecoinContext = parts.find(p => 
            p.toLowerCase().includes('memecoin') || 
            p.toLowerCase().includes('crypto') ||
            p.toLowerCase().includes('token')
        ) || parts[1];

        return [description, memecoinContext];
    }

    clearCache(): void {
        this.cache.clear();
        logger.info('Image analysis cache cleared');
    }
}