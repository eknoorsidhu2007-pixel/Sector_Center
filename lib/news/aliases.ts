/**
 * Curated company knowledge for relevance scoring.
 *
 * Two distinct concepts live here:
 *
 * - DANGEROUS_TICKERS: tickers that are ordinary English words ("NOW", "ALL",
 *   "ON"...). A bare ticker match on one of these says nothing, so the
 *   relevance scorer ignores them unless corroborated by the company name or
 *   a strong alias appearing in the same article.
 *
 * - COMPANY_ALIASES: hand-maintained product/executive/subsidiary names for
 *   the companies most likely to be viewed. "Strong" aliases are distinctive
 *   enough to score on their own ("iphone", "tim cook"). "Weak" aliases are
 *   real but ambiguous ("app store" appears in Google antitrust stories), so
 *   they never score — they only corroborate a dangerous ticker.
 *
 * This map is deliberately small. It is an enhancement layer on top of
 * name/ticker matching, not a correctness dependency: companies absent from
 * the map are still matched by name and ticker.
 */

export const DANGEROUS_TICKERS: ReadonlySet<string> = new Set([
  // Explicitly identified as hazardous for this product.
  "NOW", "T", "ALL", "LOW", "ON", "ARE", "HD", "BIG",
  // Every single-letter ticker: too easy to hit as a stray capital.
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "U", "V", "W", "X", "Y", "Z",
  // Other real tickers that double as common words.
  "AM", "AN", "AT", "BE", "BY", "CAN", "DO", "FOR", "GO", "HE", "IF",
  "IN", "IS", "IT", "ME", "MY", "NO", "OR", "SO", "TO", "UP", "US", "WE",
  "NEW", "HAS", "COST", "FAST", "BEST", "WELL", "EVER", "POST", "REAL",
  "OPEN", "WORK", "PLAY", "LIVE", "LOVE", "CARE", "PLAN", "BOND", "GOLD",
  "CASH", "DEBT", "FUND", "BULL", "BEAR", "ROCK", "STAR", "WISH", "TIP",
]);

export interface CompanyAliases {
  /** Display-quality name used when counting "other companies" in a headline. */
  name: string;
  strong: string[];
  weak: string[];
}

export const COMPANY_ALIASES: Readonly<Record<string, CompanyAliases>> = {
  AAPL: {
    name: "Apple",
    strong: [
      "iphone", "ipad", "macbook", "airpods", "apple watch", "vision pro",
      "tim cook", "john ternus", "apple park", "apple intelligence",
      "apple tv", "apple one", "apple music", "icloud", "macos", "ios",
      "watchos", "ipados",
    ],
    // "app store" alone is not evidence: Google/Epic antitrust coverage uses
    // it (observed false-matching an Alphabet settlement story on AAPL).
    weak: ["app store"],
  },
  MSFT: {
    name: "Microsoft",
    strong: [
      "satya nadella", "windows", "xbox", "azure", "office 365",
      "microsoft 365", "copilot", "github", "linkedin", "teams",
      "openai", "bing", "surface",
    ],
    weak: [],
  },
  NVDA: {
    name: "Nvidia",
    strong: [
      "jensen huang", "geforce", "cuda", "rtx", "blackwell", "hopper",
      "h100", "h200", "nvlink", "dgx",
    ],
    weak: [],
  },
  GOOGL: {
    name: "Alphabet",
    strong: [
      "google", "youtube", "sundar pichai", "waymo", "android", "gemini",
      "pixel", "chrome", "deepmind", "google cloud",
    ],
    // "search" is a generic news word; it never scores, only corroborates.
    weak: ["search"],
  },
  GOOG: {
    name: "Alphabet",
    strong: [
      "google", "youtube", "sundar pichai", "waymo", "android", "gemini",
      "pixel", "chrome", "deepmind", "google cloud",
    ],
    weak: [],
  },
  META: {
    name: "Meta",
    strong: [
      "facebook", "instagram", "whatsapp", "mark zuckerberg", "threads",
      "oculus", "quest", "ray-ban meta", "llama", "meta ai", "reels",
    ],
    weak: [],
  },
  AMZN: {
    name: "Amazon",
    strong: [
      "aws", "andy jassy", "prime video", "kindle", "alexa", "whole foods",
      "amazon prime", "twitch", "project kuiper", "zoox",
    ],
    weak: ["prime"],
  },
  TSLA: {
    name: "Tesla",
    strong: [
      "elon musk", "model 3", "model y", "model s", "model x", "cybertruck",
      "tesla energy", "supercharger", "fsd", "full self-driving", "robotaxi",
      "gigafactory", "optimus",
    ],
    // Musk spans Tesla, xAI, X, and SpaceX; "spacex" is NOT a Tesla alias.
    weak: [],
  },
  NFLX: {
    name: "Netflix",
    strong: ["ted sarandos", "netflix originals", "squid game", "stranger things"],
    weak: [],
  },
  DIS: {
    name: "Disney",
    strong: [
      "bob iger", "espn", "hulu", "pixar", "marvel", "star wars",
      "disney+", "disneyland", "disney world", "abc",
    ],
    weak: ["abc"],
  },
  JPM: {
    name: "JPMorgan",
    strong: ["jamie dimon", "jpmorgan", "jp morgan", "j.p. morgan"],
    weak: ["chase"],
  },
  V: { name: "Visa", strong: [], weak: ["visa"] },
  MA: { name: "Mastercard", strong: ["mastercard"], weak: [] },
  WMT: {
    name: "Walmart",
    strong: ["walmart", "sam's club", "doug mcmillon"],
    weak: [],
  },
  XOM: { name: "Exxon", strong: ["exxon", "exxonmobil"], weak: [] },
  JNJ: {
    name: "Johnson & Johnson",
    strong: ["johnson & johnson", "johnson and johnson", "j&j"],
    weak: [],
  },
  PFE: { name: "Pfizer", strong: ["pfizer"], weak: [] },
  KO: { name: "Coca-Cola", strong: ["coca-cola", "coca cola", "coke"], weak: ["coke"] },
  PEP: { name: "PepsiCo", strong: ["pepsi", "pepsico"], weak: [] },
  MCD: { name: "McDonald's", strong: ["mcdonald's", "mcdonalds"], weak: [] },
  NKE: { name: "Nike", strong: ["nike", "jordan brand"], weak: [] },
  BA: { name: "Boeing", strong: ["boeing", "737 max", "787 dreamliner"], weak: [] },
  CRM: {
    name: "Salesforce",
    strong: ["salesforce", "marc benioff", "slack", "tableau", "agentforce"],
    weak: ["slack"],
  },
  ORCL: {
    name: "Oracle",
    strong: ["oracle", "larry ellison", "oci"],
    weak: [],
  },
  INTC: { name: "Intel", strong: ["intel", "lip-bu tan", "foundry"], weak: [] },
  AMD: { name: "AMD", strong: ["amd", "lisa su", "ryzen", "epyc", "radeon"], weak: [] },
  QCOM: { name: "Qualcomm", strong: ["qualcomm", "snapdragon"], weak: [] },
  AVGO: { name: "Broadcom", strong: ["broadcom", "hock tan", "vmware"], weak: ["vmware"] },
  MU: { name: "Micron", strong: ["micron", "hbm"], weak: [] },
  PLTR: {
    name: "Palantir",
    strong: ["palantir", "alex karp", "gotham", "foundry"],
    weak: ["foundry"],
  },
  UBER: { name: "Uber", strong: ["uber", "dara khosrowshahi"], weak: [] },
  LYFT: { name: "Lyft", strong: ["lyft"], weak: [] },
  ABNB: { name: "Airbnb", strong: ["airbnb", "brian chesky"], weak: [] },
  COIN: { name: "Coinbase", strong: ["coinbase", "brian armstrong"], weak: [] },
  SHOP: { name: "Shopify", strong: ["shopify", "tobi lutke"], weak: [] },
  XYZ: {
    name: "Block",
    strong: ["block", "square", "cash app", "jack dorsey"],
    weak: ["square"],
  },
  PYPL: { name: "PayPal", strong: ["paypal", "venmo"], weak: [] },
  SPOT: { name: "Spotify", strong: ["spotify", "daniel ek"], weak: [] },
  SNAP: { name: "Snap", strong: ["snap", "snapchat", "evan spiegel"], weak: [] },
  PINS: { name: "Pinterest", strong: ["pinterest"], weak: [] },
  RBLX: { name: "Roblox", strong: ["roblox"], weak: [] },
  HOOD: { name: "Robinhood", strong: ["robinhood", "vlad tenev"], weak: [] },
  GM: {
    name: "General Motors",
    strong: ["general motors", "mary barra", "chevrolet", "cadillac", "gmc"],
    weak: [],
  },
  F: {
    name: "Ford",
    strong: ["ford", "jim farley", "f-150", "mustang", "bronco"],
    weak: [],
  },
  RIVN: { name: "Rivian", strong: ["rivian", "rj scaringe"], weak: [] },
  LCID: { name: "Lucid", strong: ["lucid", "lucid air"], weak: [] },
  TM: { name: "Toyota", strong: ["toyota"], weak: [] },
  X: {
    name: "United States Steel",
    strong: ["u.s. steel", "united states steel", "us steel", "nippon steel"],
    weak: [],
  },
  T: {
    name: "AT&T",
    strong: ["at&t", "att", "at and t", "warnermedia"],
    weak: [],
  },
  NOW: {
    name: "ServiceNow",
    strong: ["servicenow", "bill mcdermott"],
    weak: [],
  },
  ALL: { name: "Allstate", strong: ["allstate"], weak: [] },
  LOW: { name: "Lowe's", strong: ["lowe's", "lowes"], weak: [] },
  ON: { name: "ON Semiconductor", strong: ["onsemi", "on semiconductor"], weak: [] },
  HD: { name: "Home Depot", strong: ["home depot"], weak: [] },
  BIG: { name: "Big Lots", strong: ["big lots"], weak: [] },
  ARE: {
    name: "Alexandria Real Estate",
    strong: ["alexandria real estate"],
    weak: [],
  },
  // Class shares reach this via the root lookup in aliasesFor ("BRK.A" -> BRK).
  BRK: { name: "Berkshire Hathaway", strong: ["berkshire", "warren buffett"], weak: [] },
  GS: { name: "Goldman Sachs", strong: ["goldman", "goldman sachs", "david solomon"], weak: [] },
  MS: { name: "Morgan Stanley", strong: ["morgan stanley", "ted pick"], weak: [] },
  BAC: { name: "Bank of America", strong: ["bank of america", "bofa", "brian moynihan"], weak: ["bofa"] },
  C: { name: "Citigroup", strong: ["citigroup", "citi", "jane fraser"], weak: [] },
  WFC: { name: "Wells Fargo", strong: ["wells fargo"], weak: [] },
  AXP: { name: "American Express", strong: ["american express", "amex"], weak: ["amex"] },
  UNH: { name: "UnitedHealth", strong: ["unitedhealth", "optum", "united healthcare"], weak: [] },
  LLY: { name: "Eli Lilly", strong: ["eli lilly", "lilly", "mounjaro", "zepbound"], weak: ["lilly"] },
  NVO: { name: "Novo Nordisk", strong: ["novo nordisk", "ozempic", "wegovy"], weak: [] },
  COST: { name: "Costco", strong: ["costco"], weak: [] },
  SBUX: { name: "Starbucks", strong: ["starbucks", "brian niccol"], weak: [] },
  AAL: { name: "American Airlines", strong: ["american airlines"], weak: [] },
  DAL: { name: "Delta", strong: ["delta air", "delta airlines"], weak: ["delta"] },
  UAL: { name: "United Airlines", strong: ["united airlines"], weak: [] },
  MAR: { name: "Marriott", strong: ["marriott"], weak: [] },
};

/**
 * Aliases are keyed by the ticker Finnhub/search uses. Class-share tickers
 * (BRK.A) are normalized to their root (BRK) before lookup by the caller.
 */
export function aliasesFor(symbol: string): CompanyAliases | null {
  const direct = COMPANY_ALIASES[symbol];

  if (direct) {
    return direct;
  }

  const root = symbol.split(".")[0];

  return COMPANY_ALIASES[root] ?? null;
}
