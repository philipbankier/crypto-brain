import { Configuration, OpenAIApi } from 'openai';
import { ImageAnalysis } from '../types';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export class ImageAnalyzer {
    private openai: OpenAIApi;
    private cache: Map<string, { analysis: ImageAnalysis, timestamp: number }> = new Map();
    private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

    constructor() {
        const configuration = new Configuration({
            apiKey: config.openai.apiKey,
        });
        this.openai = new OpenAIApi(configuration);
    }

    async analyzeImage(imageUrl: string): Promise<ImageAnalysis> {
        try {
            // Check cache first
            const cached = this.cache.get(imageUrl);
            if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
                return cached.analysis;
            }

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

            const content = response.data.choices[0]?.message?.content || '';
            
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
            logger.error('Error analyzing image:', error);
            throw new Error(`Failed to analyze image: ${error.message}`);
        }
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
    }
}