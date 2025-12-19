# GraphQL Cache & Subscription Experiment

A demonstration of how Apollo Client's normalized cache automatically updates when GraphQL subscriptions return the same type as queries.

## Architecture

```
┌─────────────────┐         ┌─────────────────┐
│   React App     │         │  GraphQL Server │
│   (Apollo)      │◄───────►│  (Apollo + WS)  │
│   :3000         │         │  :4000          │
└─────────────────┘         └─────────────────┘
        │                           │
        │  1. Query (HTTP)          │
        │  ──────────────────►      │
        │  ◄──────────────────      │
        │     Token data            │
        │                           │
        │  2. Subscription (WS)     │
        │  ◄═══════════════════     │
        │     Token updates         │
        │     (same type + id)      │
        │                           │
        ▼                           │
  ┌───────────┐                     │
  │  Apollo   │  Auto-merges by id  │
  │  Cache    │◄────────────────────┘
  └───────────┘
```

## The Key Insight

When a subscription returns the **same type** with the **same `id`** as a query, Apollo Client automatically merges the data into its normalized cache:

```graphql
# Query fetches token and caches as Token:<id>
query GetToken($symbol: String!) {
  token(symbol: $symbol) {
    id          # ← Cache key: "Token:token:ethereum:native"
    symbol
    name
    price
    change24h
  }
}

# Subscription returns Token with same id
subscription OnTokenUpdated($symbol: String!) {
  tokenUpdated(symbol: $symbol) {
    id          # ← Matches cache key, triggers auto-merge
    price
    change24h
  }
}
```

**Result:** The UI re-renders automatically without manual state management.

## Running the Project

### 1. Start the GraphQL Server

```bash
cd server
npm install
npm start
```

Server runs at:
- HTTP: `http://localhost:4000/graphql`
- WebSocket: `ws://localhost:4000/graphql`

### 2. Start the React App

```bash
cd app
npm install
npm run dev
```

App runs at `http://localhost:3000`

## Project Structure

```
├── server/
│   └── src/
│       └── index.js        # Apollo Server + WebSocket subscriptions
│
├── app/
│   └── src/
│       ├── main.tsx        # Apollo Client setup (HTTP + WS split link)
│       ├── App.tsx         # React components with useQuery + useSubscription
│       └── styles.css      # UI styling
```

## Server Schema

```graphql
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
```

## Apollo Client Setup

The app uses a split link configuration:

- **HTTP Link** → for queries and mutations
- **WebSocket Link** → for subscriptions

```typescript
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,   // Subscriptions go over WebSocket
  httpLink  // Queries go over HTTP
);
```

## Cache Normalization

Apollo normalizes data using `__typename` + `id`:

```
Cache contents:
├── Token:token:ethereum:native  { symbol: "ETH", price: 2250.50, ... }
├── Token:token:bitcoin:native   { symbol: "BTC", price: 43500.00, ... }
└── Token:token:solana:native    { symbol: "SOL", price: 98.75, ... }
```

When a subscription publishes an update with matching `id`, Apollo merges the fields automatically.

## Tech Stack

**Server:**
- Node.js (ESM)
- Apollo Server 4
- graphql-ws (WebSocket transport)
- graphql-subscriptions (PubSub)

**Client:**
- React 18
- TypeScript
- Apollo Client 3
- Vite

