/**
 * TypeScript shapes that match `supabase/migrations/20260919190000_research_foundation.sql`.
 *
 * These are the rows we persist. Quotes and candles stay in the memory cache
 * and are never stored here.
 */

export type StatementType = "balance_sheet" | "income" | "cash_flow";

export interface CompanyRow {
  cik: string;
  ticker: string;
  name: string;
  exchange: string | null;
  sic: string | null;
  sic_description: string | null;
  entity_type: string | null;
  state_of_incorporation: string | null;
  fiscal_year_end: string | null;
  website: string | null;
  ein: string | null;
  former_names: FormerNameRow[];
}

export interface FormerNameRow {
  name: string;
  valid_from: string | null;
  valid_to: string | null;
}

export interface TickerAliasRow {
  cik: string;
  ticker: string;
  is_current: boolean;
  source: "sec-directory" | "separator-variant" | "submissions";
  valid_from: string | null;
  valid_to: string | null;
}

export interface FilingRow {
  accession_number: string;
  cik: string;
  form: string;
  filed_at: string | null;
  accepted_at: string | null;
  primary_document: string | null;
  filing_url: string | null;
}

export interface FinancialStatementRow {
  cik: string;
  accession_number: string | null;
  form: string | null;
  fiscal_year: number | null;
  fiscal_period: string | null;
  start_date: string | null;
  end_date: string | null;
  statement_type: StatementType;
  concept: string;
  label: string | null;
  unit: string | null;
  value: number | null;
}

export interface InsiderTransactionRow {
  cik: string;
  accession_number: string | null;
  reporter_name: string;
  reporter_cik: string | null;
  transaction_code: string;
  is_derivative: boolean;
  share_change: number | null;
  shares_held: number | null;
  price: number | null;
  value: number | null;
  transaction_date: string | null;
  filed_at: string | null;
  security_title: string | null;
}
