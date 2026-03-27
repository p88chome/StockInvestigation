export type MarketType = "tw" | "us" | "crypto";

export const TRACKED_STOCKS: { ticker: string; name: string; apiTicker: string; market: MarketType }[] = [
  // Taiwan Stocks
  { ticker: "2330", name: "台積電 TSMC", apiTicker: "2330.TW", market: "tw" },
  { ticker: "2317", name: "鴻海 Foxconn", apiTicker: "2317.TW", market: "tw" },
  { ticker: "2454", name: "聯發科 MediaTek", apiTicker: "2454.TW", market: "tw" },
  { ticker: "2382", name: "廣達 Quanta", apiTicker: "2382.TW", market: "tw" },
  { ticker: "2308", name: "台達電 Delta", apiTicker: "2308.TW", market: "tw" },
  { ticker: "2881", name: "富邦金 Fubon", apiTicker: "2881.TW", market: "tw" },
  { ticker: "2303", name: "聯電 UMC", apiTicker: "2303.TW", market: "tw" },
  { ticker: "2002", name: "中鋼 CSC", apiTicker: "2002.TW", market: "tw" },
  
  // US Stocks
  { ticker: "AAPL", name: "蘋果 Apple", apiTicker: "AAPL", market: "us" },
  { ticker: "NVDA", name: "輝達 Nvidia", apiTicker: "NVDA", market: "us" },
  { ticker: "TSLA", name: "特斯拉 Tesla", apiTicker: "TSLA", market: "us" },
  { ticker: "MSFT", name: "微軟 Microsoft", apiTicker: "MSFT", market: "us" },
  { ticker: "META", name: "元宇宙 Meta", apiTicker: "META", market: "us" },
  
  // Crypto
  { ticker: "BTC", name: "比特幣 Bitcoin", apiTicker: "BTC-USD", market: "crypto" },
  { ticker: "ETH", name: "以太幣 Ethereum", apiTicker: "ETH-USD", market: "crypto" },
  { ticker: "SOL", name: "索拉納 Solana", apiTicker: "SOL-USD", market: "crypto" },
];

export const TAIEX_TICKER = "^TWII";
export const SPX_TICKER = "^GSPC"; // S&P 500
export const BTC_TICKER = "BTC-USD"; // Bitcoin as crypto market proxy
