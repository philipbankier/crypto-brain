import { Configuration, OpenAIApi } from 'openai';
import { TweetData, ImageAnalysis } from '../types';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export class HybridPatternMatcher {
    private openai: OpenAIApi;
    private readonly MAJOR_EXCHANGES = ['binance', 'coinbase'];
    
    // Quick filter keywords
    private readonly QUICK_FILTERS = {
        animal_incident: ['rescue', 'hurt', 'injured', 'save', 'pet', 'animal', 'dog', 'cat', 'bird', 'squirrel'],
        exchange_listing: ['listing', 'listed', 'trading', 'support', 'launches', 'add', 'lists']
    };

    constructor() {
        const configuration = new Configuration({
            apiKey: config.openai.apiKey,
        });
        this.openai = new OpenAIApi(configuration);
    }

    private buildPrompt(tweet: TweetData, imageAnalysis?: ImageAnalysis): string {
        return `Analyze this tweet for potential memecoin names. Create memorable, catchy names based on the context, cultural references, and meme potential.

Tweet Content: ${tweet.content}
Author: ${tweet.author}
${imageAnalysis ? `Image Analysis: ${imageAnalysis.description}
Image Context: ${imageAnalysis.memecoinContext}` : ''}

Guidelines for generating memecoin names:
1. Combine relevant words from the tweet/context (e.g., "TeachYoung" from "teach them young")
2. Include references to key figures if present (e.g., "MuskPup" from Elon Musk + young kid)
3. Keep names catchy and memorable (2-3 words maximum)
4. Consider both literal and metaphorical connections
5. Include relevant suffixes when appropriate (INU, PEPE, AI, etc.)

Example generations:
Tweet: "Peanut the squirrel was rescued today"
Names: PEANUT, SQUIRRELRESCUE, NUTPUMP

Tweet: "Wow, look at these diamond hands!"
Names: DIAMONDHANDS, HOLDGEMS, DIAMONDAPE

Format your response exactly as follows:
NAMES: [comma-separated list of potential memecoin names]
REASONING: [brief explanation for each name]
CONFIDENCE: [0-100]
CATEGORY: [viral_moment/vip_related/cultural_reference/other]`;
    }

    private async quickFilter(tweet: TweetData): Promise<{
        needsLLMAnalysis: boolean;
        patterns: string[];
    }> {
        const text = tweet.content.toLowerCase();
        const patterns: string[] = [];
        
        // Check for exchange listing
        if (this.MAJOR_EXCHANGES.includes(tweet.author.toLowerCase()) &&
            this.QUICK_FILTERS.exchange_listing.some(term => text.includes(term))) {
            patterns.push('exchange_listing');
        }

        // Check for animal incidents
        const hasAnimalTerms = this.QUICK_FILTERS.animal_incident.some(term => 
            text.includes(term)
        );
        if (hasAnimalTerms) {
            patterns.push('animal_incident');
        }

        // Determine if LLM analysis is needed
        const needsLLMAnalysis = patterns.length > 0 || 
            tweet.engagement.likes > config.analysis.thresholds.engagement.likes ||
            tweet.engagement.retweets > config.analysis.thresholds.engagement.retweets;

        return { needsLLMAnalysis, patterns };
    }

    private parseAnalysisResponse(response: string): any {
        try {
            const names = (response.match(/NAMES: \[(.*?)\]/) || ['', ''])[1]
                .split(',')
                .map(name => name.trim())
                .filter(name => name.length > 0);
                
            const reasoning = (response.match(/REASONING: (.*?)(?=\nCONFIDENCE:)/) || ['', ''])[1].trim();
            const confidence = parseInt((response.match(/CONFIDENCE: (\d+)/) || ['', '0'])[1]);
            const category = (response.match(/CATEGORY: (\w+)/) || ['', 'other'])[1];

            return {
                suggestedCoins: names,
                reasoning,
                confidence,
                category
            };
        } catch (error) {
            logger.error('Error parsing LLM response:', error);
            throw new Error('Failed to parse LLM response');
        }
    }

    async analyzePattern(
        tweet: TweetData,
        imageAnalysis?: ImageAnalysis
    ): Promise<any> {
        try {
            const { needsLLMAnalysis, patterns } = await this.quickFilter(tweet);

            if (!needsLLMAnalysis) {
                return {
                    patterns,
                    suggestedCoins: [],
                    confidence: 50,
                    reasoning: "Quick filter match only",
                    category: "other"
                };
            }

            const prompt = this.buildPrompt(tweet, imageAnalysis);
            
            const response = await this.openai.createChatCompletion({
                model: config.openai.model.text,
                messages: [
                    {
                        role: "system",
                        content: "You are an expert at detecting potential memecoin opportunities from social media posts. You err on the side of inclusion - better to flag a potential opportunity than miss one."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 500,
                timeout: 10000 // 10 second timeout
            });

            const analysis = this.parseAnalysisResponse(
                response.data.choices[0]?.message?.content || ''
            );

            return {
                ...analysis,
                patterns: [...new Set([...patterns, ...this.inferPatternsFromAnalysis(analysis)])]
            };

        } catch (error) {
            logger.error('Error in pattern analysis:', error);
            throw new Error(`Pattern analysis failed: ${error.message}`);
        }
    }

    private inferPatternsFromAnalysis(analysis: any): string[] {
        const patterns: string[] = [];
        
        if (analysis.category === 'vip_related') {
            patterns.push('vip_tweet');
        }
        if (analysis.confidence >= 80) {
            patterns.push('high_confidence');
        }
        
        return patterns;
    }
}