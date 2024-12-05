import { MongoClient } from 'mongodb';
import { GraphService } from '../services/graph-service';
import { config } from '../config/config';
import { logger } from '../utils/logger';

async function initializeDatabases() {
    try {
        // Initialize MongoDB
        const mongoClient = new MongoClient(config.mongodb.uri);
        await mongoClient.connect();
        
        const db = mongoClient.db(config.mongodb.dbName);
        
        // Create indexes
        await db.collection('tweets').createIndex({ 'tweetData.id': 1 }, { unique: true });
        await db.collection('vipAccounts').createIndex({ username: 1 }, { unique: true });
        
        logger.info('MongoDB initialized successfully');

        // Initialize Neo4j
        const graphService = new GraphService();
        await graphService.initializeSchema();
        logger.info('Neo4j initialized successfully');

        await mongoClient.close();
        await graphService.cleanup();
        
    } catch (error) {
        logger.error('Database initialization failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    initializeDatabases();
}