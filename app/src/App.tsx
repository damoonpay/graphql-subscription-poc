import { useQuery, useSubscription, gql } from '@apollo/client';
import { useState, useEffect, useRef, createContext, useContext } from 'react';

// GraphQL Query for individual token
const GET_TOKEN = gql`
  query GetToken($symbol: String!) {
    token(symbol: $symbol) {
      tokenResourceId
      symbol
      name
      price
      change24h
    }
  }
`;

// GraphQL Subscription - accepts a list of symbols, returns array of updated tokens
const TOKENS_SUBSCRIPTION = gql`
  subscription OnTokensUpdated($symbols: [String!]!) {
    tokensUpdated(symbols: $symbols) {
      tokenResourceId
      price
      change24h
    }
  }
`;

interface Token {
  tokenResourceId: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
}

const TOKENS = ['ETH', 'BTC', 'SOL'];

// Context to share subscription updates with all TokenCards
interface SubscriptionContextType {
  updatedTokens: Token[];
}
const SubscriptionContext = createContext<SubscriptionContextType>({ updatedTokens: [] });

function TokenCard({ symbol }: { symbol: string }) {
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const previousPriceRef = useRef<number | null>(null);

  // Individual query for this token
  const { data, loading, error } = useQuery<{ token: Token }>(GET_TOKEN, {
    variables: { symbol },
  });

  // Get subscription updates from context
  const { updatedTokens } = useContext(SubscriptionContext);

  // Handle subscription updates for this token
  useEffect(() => {
    const updatedToken = updatedTokens.find(t => t.tokenResourceId === data?.token.tokenResourceId);
    if (updatedToken) {
      const newPrice = updatedToken.price;
      
      // Determine price direction for animation
      if (previousPriceRef.current !== null) {
        setPriceDirection(newPrice > previousPriceRef.current ? 'up' : 'down');
        setTimeout(() => setPriceDirection(null), 500);
      }
      
      previousPriceRef.current = newPrice;
      setLastUpdate(new Date().toLocaleTimeString());
    }
  }, [updatedTokens, data]);

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
  const [updatedTokens, setUpdatedTokens] = useState<Token[]>([]);

  // Single subscription for all tokens
  const { data: subData } = useSubscription<{ tokensUpdated: Token[] }>(TOKENS_SUBSCRIPTION, {
    variables: { symbols: TOKENS },
  });

  // Update context when subscription receives data
  useEffect(() => {
    if (subData?.tokensUpdated) {
      setUpdatedTokens(subData.tokensUpdated);
    }
  }, [subData]);

  return (
    <SubscriptionContext.Provider value={{ updatedTokens }}>
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
                <p>Initial token data fetched via individual <code>token</code> queries</p>
              </div>
              <div className="info-step">
                <span className="step-number">2</span>
                <p><strong>Single subscription</strong> for all tokens - returns only updated ones</p>
              </div>
              <div className="info-step">
                <span className="step-number">3</span>
                <p>Apollo Client auto-updates cache → Only updated tokens animate!</p>
              </div>
            </div>
          </div>
        </main>
        
        <footer className="footer">
          <p>Built with Apollo Client + GraphQL Subscriptions + Normalized Cache</p>
        </footer>
      </div>
    </SubscriptionContext.Provider>
  );
}

export default App;
