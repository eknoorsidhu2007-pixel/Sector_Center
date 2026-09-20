export {
  SecError,
  accessionPath,
  archiveDocumentUrl,
  fetchArchiveDocument,
  fetchArchiveIndex,
  fetchCompanyFacts,
  fetchCompanyTickers,
  fetchCompanyTickersWithExchange,
  fetchFrame,
  fetchSubmissions,
  padCik,
  searchFullText,
  toResearchApiError,
  unpadCik,
} from "./sec-client";
export type { FullTextSearchParams } from "./sec-client";

export {
  aliasesFromIdentity,
  fetchCompanyIdentity,
  getCompanyDirectory,
  listCompanies,
  listTickerAliases,
  resolveByCik,
  resolveCik,
} from "./entities";
export type {
  CompanyEntity,
  CompanyIdentity,
  FormerName,
  TickerAlias,
} from "./entities";

export {
  classifyTransactionCode,
  fetchRecentForm4Transactions,
  form4CacheKey,
  listOwnershipFilings,
  parseArchiveForm4,
  parseOwnershipXml,
  toInsiderTransaction,
} from "./form4";
export type { Form4Transaction, OwnershipFilingRef } from "./form4";

export { buildCompanySeed, enrichCompanySeed, identityToSeedPatch } from "./seed";
export type { CompanySeed } from "./seed";

export type {
  CompanyRow,
  FilingRow,
  FinancialStatementRow,
  FormerNameRow,
  InsiderTransactionRow,
  StatementType,
  TickerAliasRow,
} from "./schema";
