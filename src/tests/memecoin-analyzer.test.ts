describe('MemecoinAnalyzer - VIP Tweet Analysis', () => {
    let analyzer: MemecoinAnalyzer;

    beforeEach(async () => {
        analyzer = new MemecoinAnalyzer();
        await analyzer.initialize();
    });

    afterEach(async () => {
        await analyzer.cleanup();
    });

    test('should analyze Elon Musk tweet with kid photo correctly', async () => {
        const tweetData: TweetData = {
            id: '123456789',
            content: '@GailAlfarATX Teach \'em young!\nLil X is having a great time.',
            author: 'elonmusk',
            url: 'https://twitter.com/elonmusk/status/123456789',
            engagement: {
                likes: 45000,
                retweets: 5000,
                replies: 3000
            },
            mediaUrls: ['https://example.com/capitol-visit.jpg']
        };

        const imageAnalysis: ImageAnalysis = {
            description: 'A young child with Elon Musk and others at what appears to be the US Capitol, with John Thune present. The child is holding something and appears engaged in the moment.',
            memecoinContext: 'The image shows a significant political/business interaction with a young person present, which could be relevant for youth or future-themed memecoins.'
        };

        const result = await analyzer.analyzeTweetForMemecoins(tweetData, imageAnalysis);

        // Test key aspects
        expect(result.analysis.memecoinDetection.confidenceScore).toBeGreaterThanOrEqual(
            config.analysis.thresholds.confidence.high
        );

        // Check VIP detection
        expect(result.analysis.vipContext?.username).toBe('elonmusk');
        expect(result.analysis.vipContext?.influenceScore).toBeGreaterThan(80);

        // Verify memecoin name generation
        expect(result.analysis.memecoinDetection.identifiedCoins).toEqual(
            expect.arrayContaining([
                expect.stringMatching(/YOUNG|TEACH|MUSK/i)
            ])
        );

        // Check pattern recognition
        expect(result.analysis.patterns).toContain('vip_tweet');

        // Verify MongoDB storage
        const storedAnalysis = await analyzer['mongoClient']
            .db(config.mongodb.dbName)
            .collection(config.mongodb.collections.tweets)
            .findOne({ 'tweetData.id': tweetData.id });
            
        expect(storedAnalysis).toBeTruthy();

        // Check graph relationships
        const relations = await analyzer['graphService'].getRelatedEvents(
            result.analysis.memecoinDetection.identifiedCoins[0]
        );
        expect(relations.length).toBeGreaterThan(0);
    });

    test('should handle variations of name generation', async () => {
        // Test with same tweet but different responses
        const variations = [
            'YOUNGMUSK',
            'TEACHYOUNG',
            'LILXINU',
            'MUSKNEXT',
            'CAPITALKIDS'
        ];

        // Run multiple analyses to ensure name generation is consistent and valid
        const results = await Promise.all(
            Array(3).fill(null).map(() => 
                analyzer.analyzeTweetForMemecoins(tweetData, imageAnalysis)
            )
        );

        // Verify each analysis generates valid names
        results.forEach(result => {
            expect(result.analysis.memecoinDetection.identifiedCoins).toEqual(
                expect.arrayContaining([
                    expect.stringMatching(/^[A-Z0-9]{3,20}$/)
                ])
            );
        });
    });
});