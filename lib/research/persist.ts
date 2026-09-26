/**
 * Server-only writes for SEC company identity.
 *
 * Uses the service-role key so RLS does not block the seed. Never import this
 * module from a client component — the service-role key must not reach the
 * browser. The stock page does not call this.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { CompanySeed } from "./seed";
import type { CompanyRow, TickerAliasRow } from "./schema";

const UPSERT_CHUNK = 500;

export interface PersistCompanySeedResult {
  companiesWritten: number;
  aliasesWritten: number;
}

export interface StoredCompanyIdentity {
  cik: string;
  ticker: string;
  name: string;
}

function requireServer(): void {
  if (typeof window !== "undefined") {
    throw new Error(
      "Research persistence is server-only and cannot run in the browser"
    );
  }
}

function describeSupabaseFailure(message: string): string {
  if (message.includes("ENOTFOUND") || message.includes("fetch failed")) {
    return `${message}. Check NEXT_PUBLIC_SUPABASE_URL and that the Supabase project is running.`;
  }

  if (
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("Could not find the table")
  ) {
    return `${message}. Apply supabase/migrations/20260919190000_research_foundation.sql first.`;
  }

  return message;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

/** Service-role client. Bypasses RLS. Never expose this client to the browser. */
export function createResearchStore(): SupabaseClient {
  requireServer();

  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

/**
 * Directory seed can list several share classes under one CIK. The table is
 * keyed on CIK, so we keep the first row and rely on ticker_aliases for the
 * rest.
 */
function uniqueCompanies(rows: CompanyRow[]): CompanyRow[] {
  const seen = new Set<string>();
  const unique: CompanyRow[] = [];

  for (const row of rows) {
    if (seen.has(row.cik)) {
      continue;
    }

    seen.add(row.cik);
    unique.push(row);
  }

  return unique;
}

/**
 * Only identity fields that the directory actually has. Null SIC / EIN / etc.
 * are omitted so a later enrichment is not wiped by a directory re-seed.
 */
function companyWriteRow(row: CompanyRow): Record<string, unknown> {
  const write: Record<string, unknown> = {
    cik: row.cik,
    ticker: row.ticker,
    name: row.name,
    exchange: row.exchange,
    former_names: row.former_names,
    updated_at: new Date().toISOString(),
  };

  if (row.sic !== null) write.sic = row.sic;
  if (row.sic_description !== null) write.sic_description = row.sic_description;
  if (row.entity_type !== null) write.entity_type = row.entity_type;
  if (row.state_of_incorporation !== null) {
    write.state_of_incorporation = row.state_of_incorporation;
  }
  if (row.fiscal_year_end !== null) write.fiscal_year_end = row.fiscal_year_end;
  if (row.website !== null) write.website = row.website;
  if (row.ein !== null) write.ein = row.ein;

  return write;
}

function aliasWriteRow(row: TickerAliasRow): Record<string, unknown> {
  return {
    cik: row.cik,
    ticker: row.ticker,
    is_current: row.is_current,
    source: row.source,
    valid_from: row.valid_from,
    valid_to: row.valid_to,
  };
}

async function upsertChunk(
  client: SupabaseClient,
  table: "companies" | "ticker_aliases",
  rows: Record<string, unknown>[],
  onConflict: string
): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += UPSERT_CHUNK) {
    const chunk = rows.slice(offset, offset + UPSERT_CHUNK);
    const { error } = await client.from(table).upsert(chunk, { onConflict });

    if (error) {
      throw new Error(
        `Failed to upsert ${table}: ${describeSupabaseFailure(error.message)}`
      );
    }
  }
}

export async function persistCompanySeed(
  seed: CompanySeed,
  client: SupabaseClient = createResearchStore()
): Promise<PersistCompanySeedResult> {
  requireServer();

  const companies = uniqueCompanies(seed.companies).map(companyWriteRow);
  const aliases = seed.tickerAliases.map(aliasWriteRow);

  // Companies first: ticker_aliases.fk references companies.cik.
  await upsertChunk(client, "companies", companies, "cik");
  await upsertChunk(client, "ticker_aliases", aliases, "cik,ticker");

  return {
    companiesWritten: companies.length,
    aliasesWritten: aliases.length,
  };
}

/** Lookup used by the seed script to confirm AAPL landed on CIK 0000320193. */
export async function findStoredCompanyByTicker(
  ticker: string,
  client: SupabaseClient = createResearchStore()
): Promise<StoredCompanyIdentity | null> {
  requireServer();

  const normalized = ticker.trim().toUpperCase();

  const alias = await client
    .from("ticker_aliases")
    .select("cik")
    .eq("ticker", normalized)
    .maybeSingle();

  if (alias.error) {
    throw new Error(
      `Failed to read ticker_aliases: ${describeSupabaseFailure(alias.error.message)}`
    );
  }

  const cik = (alias.data?.cik as string | undefined) ?? null;

  const companyQuery = cik
    ? client.from("companies").select("cik, ticker, name").eq("cik", cik)
    : client.from("companies").select("cik, ticker, name").eq("ticker", normalized);

  const company = await companyQuery.maybeSingle();

  if (company.error) {
    throw new Error(
      `Failed to read companies: ${describeSupabaseFailure(company.error.message)}`
    );
  }

  if (!company.data) {
    return null;
  }

  return {
    cik: company.data.cik as string,
    ticker: company.data.ticker as string,
    name: company.data.name as string,
  };
}

export async function countStoredIdentity(
  client: SupabaseClient = createResearchStore()
): Promise<{ companies: number; aliases: number }> {
  requireServer();

  const [companies, aliases] = await Promise.all([
    client.from("companies").select("cik", { count: "exact", head: true }),
    client.from("ticker_aliases").select("id", { count: "exact", head: true }),
  ]);

  if (companies.error) {
    throw new Error(
      `Failed to count companies: ${describeSupabaseFailure(companies.error.message)}`
    );
  }

  if (aliases.error) {
    throw new Error(
      `Failed to count ticker_aliases: ${describeSupabaseFailure(aliases.error.message)}`
    );
  }

  return {
    companies: companies.count ?? 0,
    aliases: aliases.count ?? 0,
  };
}
