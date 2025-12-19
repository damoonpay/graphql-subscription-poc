import { useQuery, useSubscription, gql } from '@apollo/client';
import { useState, useEffect, useRef } from 'react';

// GraphQL Query for initial token data
const GET_TOKEN = gql`
  query GetToken($symbol: String!) {
    token(symbol: $symbol) {
      id
      symbol
      name
      price
      change24h
    }
  }
`;

// GraphQL Subscription - returns Token type so Apollo can auto-update cache
const TOKEN_SUBSCRIPTION = gql`
  subscription OnTokenUpdated($symbol: String!) {
    tokenUpdated(symbol: $symbol) {
      id
      price
      change24h
    }
  }
`;

interface Token {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
}

const TOKENS = ['ETH', 'BTC', 'SOL'];

function TokenCard({ symbol }: { symbol: string }) {
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const previousPriceRef = useRef<number | null>(null);

  // Initial query to get token data - cache will be auto-updated by subscription
  const { data, loading, error } = useQuery<{ token: Token }>(GET_TOKEN, {
    variables: { symbol },
  });

  // Subscribe to token updates - Apollo auto-updates the cache because we return Token with same id
  const { data: subData } = useSubscription<{ tokenUpdated: Token }>(TOKEN_SUBSCRIPTION, {
    variables: { symbol },
  });

  // Handle subscription updates for animation
  useEffect(() => {
    if (subData?.tokenUpdated) {
      const newPrice = subData.tokenUpdated.price;
      
      // Determine price direction for animation
      if (previousPriceRef.current !== null) {
        setPriceDirection(newPrice > previousPriceRef.current ? 'up' : 'down');
        setTimeout(() => setPriceDirection(null), 500);
      }
      
      previousPriceRef.current = newPrice;
      setLastUpdate(new Date().toLocaleTimeString());
    }
  }, [subData]);

  // Set initial price ref from query
  useEffect(() => {
    if (data?.token && previousPriceRef.current === null) {
      previousPriceRef.current = data.token.price;
    }
  }, [data]);

  if (loading) {
    return (
      <div className="token-card loading">
        <div className="skeleton-loader"></div>
      </div>
    );
  }

  if (error || !data?.token) {
    return (
      <div className="token-card error">
        <span>Error loading {symbol}</span>
      </div>
    );
  }

  // Read directly from query data - Apollo cache is auto-updated by subscription!
  const { name, price, change24h } = data.token;
  const isPositive = change24h >= 0;

  return (
    <div className={`token-card ${priceDirection ? `flash-${priceDirection}` : ''}`}>
      <div className="token-header">
        <div className="token-icon">{symbol.charAt(0)}</div>
        <div className="token-info">
          <h2 className="token-name">{name}</h2>
          <span className="token-symbol">{symbol}</span>
        </div>
        <div className="live-indicator">
          <span className="pulse"></span>
          LIVE
        </div>
      </div>
      
      <div className="token-price">
        <span className="price-value">
          ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className={`price-change ${isPositive ? 'positive' : 'negative'}`}>
          {isPositive ? '↑' : '↓'} {Math.abs(change24h).toFixed(2)}%
        </span>
      </div>
      
      {lastUpdate && (
        <div className="last-update">
          Last update: {lastUpdate}
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <div className="app">
      <div className="background-pattern"></div>
      
      <header className="header">
        <h1 className="title">
          <span className="title-icon">◈</span>
          Token Price Tracker
        </h1>
        <p className="subtitle">Real-time GraphQL subscriptions with automatic cache updates</p>
      </header>
      
      <main className="main">
        <div className="token-grid">
          {TOKENS.map((symbol) => (
            <TokenCard key={symbol} symbol={symbol} />
          ))}
        </div>
        
        <div className="info-panel">
          <h3>How it works</h3>
          <div className="info-steps">
            <div className="info-step">
              <span className="step-number">1</span>
              <p>Initial token data fetched via GraphQL <code>query</code></p>
            </div>
            <div className="info-step">
              <span className="step-number">2</span>
              <p>Subscription returns <code>Token</code> type with same <code>id</code></p>
            </div>
            <div className="info-step">
              <span className="step-number">3</span>
              <p>Apollo Client auto-updates cache → UI re-renders automatically!</p>
            </div>
          </div>
        </div>
      </main>
      
      <footer className="footer">
        <p>Built with Apollo Client + GraphQL Subscriptions + Normalized Cache</p>
      </footer>
    </div>
  );
}

export default App;
