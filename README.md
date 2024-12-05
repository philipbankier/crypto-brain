# Memecoin Monitor

A service that monitors Discord channels for tweets about potential memecoins, analyzes them, and tracks their performance.

## Quick Start

1. Start Chrome with debugging enabled:
```bash
# For Mac M1
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# For Linux
google-chrome --remote-debugging-port=9222

# For Windows
start chrome --remote-debugging-port=9222
```

2. Log into Discord and navigate to your target channel

3. Start the development environment:
```bash
# Start required services
docker-compose up mongodb neo4j -d

# Install dependencies
npm install

# Start the monitor
npm run dev:monitor
```

## Development Setup

### Prerequisites
- Node.js (v16 or higher)
- Docker and Docker Compose
- Google Chrome
- Git

### Environment Configuration
1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Configure the following variables:
```env
DISCORD_CHANNEL_URL=your_discord_channel_url
MONGODB_URI=mongodb://root:example@localhost:27017
NEO4J_URI=neo4j://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=example
OPENAI_API_KEY=your_openai_api_key
```

### Development Workflow

1. Start Dependencies:
```bash
docker-compose up mongodb neo4j -d
```

2. Initialize Databases:
```bash
npm run init-db
```

3. Start Chrome with Debugging:
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

4. Run the Monitor:
```bash
npm run dev:monitor
```

### Available Scripts
- `npm run dev:monitor` - Start monitor in development mode
- `npm run build` - Build TypeScript
- `npm run test` - Run tests
- `npm run lint` - Lint code
- `npm run init-db` - Initialize database schemas

## Architecture

### Core Components

#### DiscordMonitor
- Connects to existing Chrome instance
- Monitors Discord channel for tweet links
- Handles reconnection and error recovery
- Provides monitoring status

#### HybridPatternMatcher
- Quick filtering for common patterns
- LLM-based detailed analysis
- Configurable confidence scoring
- Pattern categorization

#### TokenMetricsService
- DexScreener integration
- PumpFun IDL support
- Price and volume tracking
- Market momentum scoring

#### ImageAnalyzer
- GPT-4V integration
- Image context analysis
- Caching system
- Error handling

#### MemecoinAnalyzer
- Pattern detection
- VIP analysis
- Historical context
- Confidence scoring

### Data Flow
1. Discord Message Detection
   - Monitor existing Chrome tab
   - Extract tweet URLs
   - Validate message format

2. Content Analysis
   - Scrape tweet content
   - Analyze images if present
   - Extract engagement metrics

3. Pattern Detection
   - Quick filter common patterns
   - LLM analysis for complex cases
   - Generate potential memecoin names

4. Result Storage
   - MongoDB for analysis results
   - Neo4j for relationship tracking
   - Price and volume metrics

## Monitoring and Health Checks

### Status Monitoring
- Discord connection status
- Message processing metrics
- Error tracking
- Performance metrics

### Health Check Endpoints
- `/health` - Service status
- `/metrics` - Performance metrics
- `/errors` - Error logs

## Production Deployment

### Using Docker
```bash
# Build and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f app
```

### Manual Deployment
1. Build the application:
```bash
npm run build
```

2. Start the services:
```bash
npm run start:monitor
```

## Troubleshooting

### Common Issues

1. Chrome Connection:
```bash
# Verify Chrome is running with debugging
lsof -i :9222
```

2. Database Connection:
```bash
# Check MongoDB status
docker-compose ps mongodb
# Check Neo4j status
docker-compose ps neo4j
```

3. Discord Monitoring:
- Ensure you're logged into Discord in Chrome
- Verify correct channel URL
- Check console for connection errors

### Logs
- Application logs: `logs/combined.log`
- Error logs: `logs/error.log`
- Docker logs: `docker-compose logs -f`