import { createServer } from 'http';
import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { PubSub } from 'graphql-subscriptions';
import cors from 'cors';
import bodyParser from 'body-parser';

const pubsub = new PubSub();
const TOKENS_UPDATED = 'TOKENS_UPDATED';

// Simulated token data
const tokens = {
  ETH: { tokenResourceId: 'token:ethereum:native', symbol: 'ETH', name: 'Ethereum', price: 2250.50, change24h: 2.5 },
  BTC: { tokenResourceId: 'token:bitcoin:native', symbol: 'BTC', name: 'Bitcoin', price: 43500.00, change24h: 1.8 },
  SOL: { tokenResourceId: 'token:solana:native', symbol: 'SOL', name: 'Solana', price: 98.75, change24h: -0.5 },
};

// GraphQL Schema
const typeDefs = `#graphql
  type Token {
    tokenResourceId: ID!
    symbol: String!
    name: String!
    price: Float!
    change24h: Float!
  }

  type Query {
    token(symbol: String!): Token
    tokens: [Token!]!
  }

  type Subscription {
    tokensUpdated(symbols: [String!]!): [Token!]!
  }
`;

// Resolvers
const resolvers = {
  Query: {
    token: (_, { symbol }) => {
      const upperSymbol = symbol.toUpperCase();
      return tokens[upperSymbol] || null;
    },
    tokens: () => Object.values(tokens),
  },
  Subscription: {
    tokensUpdated: {
      subscribe: (_, { symbols }) => {
        const upperSymbols = symbols.map(s => s.toUpperCase());
        console.log(`📡 New subscription for tokens: ${upperSymbols.join(', ')}`);
        
        // Create a filtered async iterator that only returns tokens the client subscribed to
        const baseIterator = pubsub.asyncIterator([TOKENS_UPDATED]);
        
        return {
          [Symbol.asyncIterator]() {
            return {
              async next() {
                while (true) {
                  const result = await baseIterator.next();
                  if (result.done) return result;
                  
                  // Filter to only include tokens the client subscribed to
                  const allUpdatedTokens = result.value.tokensUpdated;
                  const filteredTokens = allUpdatedTokens.filter(token => 
                    upperSymbols.includes(token.symbol)
                  );
                  
                  // Only return if there are tokens the client cares about
                  if (filteredTokens.length > 0) {
                    return { value: { tokensUpdated: filteredTokens }, done: false };
                  }
                }
              },
              return() {
                return baseIterator.return();
              },
            };
          },
        };
      },
    },
  },
};

// Simulate price updates - randomly update 1-2 tokens at a time
function simulatePriceUpdates() {
  setInterval(() => {
    const allSymbols = Object.keys(tokens);
    
    // Randomly pick 1 or 2 tokens to update
    const numToUpdate = Math.random() < 0.5 ? 1 : 2;
    const shuffled = [...allSymbols].sort(() => Math.random() - 0.5);
    const symbolsToUpdate = shuffled.slice(0, numToUpdate);
    
    const updatedTokens = [];
    
    symbolsToUpdate.forEach((symbol) => {
      // Random price fluctuation between -2% and +2%
      const fluctuation = (Math.random() - 0.5) * 0.04;
      const token = tokens[symbol];
      
      token.price = token.price * (1 + fluctuation);
      token.price = Math.round(token.price * 100) / 100;
      
      // Update 24h change
      token.change24h = token.change24h + (Math.random() - 0.5) * 0.5;
      token.change24h = Math.round(token.change24h * 100) / 100;
      
      updatedTokens.push({ ...token });
    });
    
    console.log(`📊 Updated ${symbolsToUpdate.join(', ')}`);
    
    // Publish the array of updated tokens
    pubsub.publish(TOKENS_UPDATED, { tokensUpdated: updatedTokens });
  }, 2000); // Update every 2 seconds
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // WebSocket server for subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  const serverCleanup = useServer({ schema }, wsServer);

  // Apollo Server
  const server = new ApolloServer({
    schema,
    plugins: [
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();

  app.use(
    '/graphql',
    cors({ origin: '*' }),
    bodyParser.json(),
    expressMiddleware(server)
  );

  const PORT = 4000;
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
    console.log(`🔌 WebSocket ready at ws://localhost:${PORT}/graphql`);
    simulatePriceUpdates();
  });
}

startServer().catch(console.error);

