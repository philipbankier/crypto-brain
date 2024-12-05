import neo4j, { Driver, Session } from 'neo4j-driver';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export class GraphService {
    private driver: Driver;

    constructor() {
        this.driver = neo4j.driver(
            config.neo4j.uri,
            neo4j.auth.basic(config.neo4j.user, config.neo4j.password)
        );
    }

    async initializeSchema(): Promise<void> {
        const session = this.driver.session();
        try {
            // Create constraints
            await session.run(`
                CREATE CONSTRAINT IF NOT EXISTS FOR (t:Tweet)
                ON (t.id) ASSERT t.id IS UNIQUE
            `);

            await session.run(`
                CREATE CONSTRAINT IF NOT EXISTS FOR (m:Memecoin)
                ON (m.symbol) ASSERT m.symbol IS UNIQUE
            `);

            await session.run(`
                CREATE CONSTRAINT IF NOT EXISTS FOR (e:Event)
                ON (e.id) ASSERT e.id IS UNIQUE
            `);

            await session.run(`
                CREATE CONSTRAINT IF NOT EXISTS FOR (a:Account)
                ON (a.id) ASSERT a.id IS UNIQUE
            `);

        } catch (error) {
            logger.error('Error initializing graph schema:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    async createTweetNode(tweetData: any): Promise<void> {
        const session = this.driver.session();
        try {
            await session.run(`
                MERGE (t:Tweet {id: $tweetId})
                SET t += $properties
                WITH t
                MATCH (a:Account {id: $authorId})
                MERGE (a)-[:POSTED]->(t)
            `, {
                tweetId: tweetData.id,
                authorId: tweetData.authorId,
                properties: {
                    content: tweetData.content,
                    timestamp: tweetData.timestamp,
                    engagement: tweetData.engagement
                }
            });
        } finally {
            await session.close();
        }
    }

    async createEventNode(eventData: any): Promise<void> {
        const session = this.driver.session();
        try {
            await session.run(`
                MERGE (e:Event {id: $eventId})
                SET e += $properties
                WITH e
                MATCH (t:Tweet {id: $initialTweetId})
                MERGE (t)-[:INITIATED]->(e)
            `, {
                eventId: eventData.id,
                initialTweetId: eventData.initialTweetId,
                properties: {
                    type: eventData.type,
                    status: eventData.status,
                    created: eventData.created,
                    engagement: eventData.engagement
                }
            });
        } finally {
            await session.close();
        }
    }

    async linkEventToMemecoin(eventId: string, memecoinSymbol: string): Promise<void> {
        const session = this.driver.session();
        try {
            await session.run(`
                MATCH (e:Event {id: $eventId})
                MERGE (m:Memecoin {symbol: $symbol})
                MERGE (e)-[:INFLUENCED]->(m)
            `, {
                eventId,
                symbol: memecoinSymbol
            });
        } finally {
            await session.close();
        }
    }

    async getRelatedEvents(memecoinSymbol: string): Promise<any[]> {
        const session = this.driver.session();
        try {
            const result = await session.run(`
                MATCH (m:Memecoin {symbol: $symbol})<-[:INFLUENCED]-(e:Event)
                RETURN e
                ORDER BY e.created DESC
                LIMIT 100
            `, { symbol: memecoinSymbol });
            
            return result.records.map(record => record.get('e').properties);
        } finally {
            await session.close();
        }
    }

    async cleanup(): Promise<void> {
        await this.driver.close();
    }
}