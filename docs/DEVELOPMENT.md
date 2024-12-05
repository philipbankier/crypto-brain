# Memecoin Monitor - Development Setup

## Prerequisites
- Node.js (v16 or higher)
- Docker and Docker Compose
- Git

## Initial Setup

1. Clone the repository and install dependencies:
```bash
git clone <repository-url>
cd memecoin-monitor
npm install
```

2. Start the development dependencies:
```bash
docker-compose up -d
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your specific configurations
```

4. Initialize the database schemas:
```bash
npm run init-db
```

## Development Workflow

1. Start the development server:
```bash
npm run dev
```

2. Run tests:
```bash
npm test
```

3. Lint and format code:
```bash
npm run lint
npm run format
```

## Database Management

### MongoDB
- UI Access: Use MongoDB Compass
- Connection string: mongodb://root:example@localhost:27017

### Neo4j
- Web Interface: http://localhost:7474
- Default credentials: neo4j/example

## Testing

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/tests/memecoin-analyzer.test.ts

# Run with coverage
npm run test:coverage
```

### Example Test Data
Sample test data is available in `src/tests/fixtures/`

## Troubleshooting

### Common Issues
1. Neo4j Connection Issues:
   - Ensure the database is running: `docker-compose ps`
   - Check logs: `docker-compose logs neo4j`

2. MongoDB Connection Issues:
   - Verify connection string in .env
   - Check MongoDB logs: `docker-compose logs mongodb`

### Debugging
- Use the Visual Studio Code debugger configuration provided
- Check logs in `logs/` directory