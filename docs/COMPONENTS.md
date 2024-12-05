# Memecoin Monitor - Component Documentation

## Core Services

### DiscordMonitor
Purpose: Monitors Discord channel for new tweet messages
Key Features:
- Real-time message monitoring using Puppeteer
- Tweet URL extraction
- Message deduplication
- Engagement metrics collection

### HybridPatternMatcher
Purpose: Analyzes tweets for memecoin patterns using both quick filters and LLM
Key Features:
- Quick pattern matching for common cases
- LLM-based analysis for complex scenarios
- Configurable confidence scoring
- Pattern categorization

### TokenMetricsService
Purpose: Fetches and tracks token price/volume metrics
Key Features:
- DexScreener integration
- PumpFun IDL support (stub)
- Price impact calculation
- Market momentum scoring

### VipTracker
Purpose: Manages and scores influential accounts
Key Features:
- Dynamic influence scoring
- Historical success tracking
- VIP detection
- Influence score updates

### GraphService
Purpose: Manages relationships between tweets, events, and memecoins
Key Features:
- Event tracking
- Relationship mapping
- Historical pattern storage
- Success rate analysis

### HistoricalPatternAnalyzer
Purpose: Analyzes historical pattern success rates
Key Features:
- Pattern success tracking
- Confidence adjustment
- Trend analysis
- Impact measurement

### MemecoinAnalyzer
Purpose: Main service orchestrating the analysis pipeline
Key Features:
- Pattern detection
- VIP analysis
- Historical context
- Confidence scoring
- Result storage

## Data Flow
1. Discord Message → DiscordMonitor
2. Tweet Content → HybridPatternMatcher
3. Pattern Analysis → MemecoinAnalyzer
4. Price Tracking → TokenMetricsService
5. Relationship Storage → GraphService
6. Historical Analysis → HistoricalPatternAnalyzer