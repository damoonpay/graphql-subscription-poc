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
const PRICE_UPDATED = 'PRICE_UPDATED';

// Simulated token data
const tokens = {
  ETH: { id: 'token:ethereum:native', symbol: 'ETH', name: 'Ethereum', price: 2250.50, change24h: 2.5 },
  BTC: { id: 'token:bitcoin:native', symbol: 'BTC', name: 'Bitcoin', price: 43500.00, change24h: 1.8 },
  SOL: { id: 'token:solana:native', symbol: 'SOL', name: 'Solana', price: 98.75, change24h: -0.5 },
};

// GraphQL Schema
const typeDefs = `#graphql
  type Token {
    id: ID!
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
    tokenUpdated(symbol: String!): Token!
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
    tokenUpdated: {
      subscribe: (_, { symbol }) => {
        const upperSymbol = symbol.toUpperCase();
        console.log(`📡 New subscription for ${upperSymbol}`);
        return pubsub.asyncIterator([`${PRICE_UPDATED}_${upperSymbol}`]);
      },
    },
  },
};

// Simulate price updates
function simulatePriceUpdates() {
  setInterval(() => {
    Object.keys(tokens).forEach((symbol) => {
      // Random price fluctuation between -2% and +2%
      const fluctuation = (Math.random() - 0.5) * 0.04;
      const token = tokens[symbol];
      
      token.price = token.price * (1 + fluctuation);
      token.price = Math.round(token.price * 100) / 100;
      
      // Update 24h change
      token.change24h = token.change24h + (Math.random() - 0.5) * 0.5;
      token.change24h = Math.round(token.change24h * 100) / 100;

      // Publish the full token object - Apollo will auto-update cache by id
      pubsub.publish(`${PRICE_UPDATED}_${symbol}`, { tokenUpdated: { ...token } });
    });
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

