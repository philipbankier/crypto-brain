private buildPrompt(tweet: TweetData, imageAnalysis?: ImageAnalysis): string {
    return `Analyze this tweet for potential memecoin names. Create memorable, catchy names based on the context, cultural references, and meme potential.

Tweet Content: ${tweet.content}
Author: ${tweet.author}
${imageAnalysis ? `Image Analysis: ${imageAnalysis.description}` : ''}

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
        return null;
    }
}