/**
 * Builds the rows that seed `companies` and `ticker_aliases`.
 *
 * Persistence lives in `lib/research/persist.ts` and is invoked only from
 * the manual seed script. This module stays a pure row builder.
 */

import {
  aliasesFromIdentity,
  fetchCompanyIdentity,
  listCompanies,
  listTickerAliases,
  type CompanyEntity,
  type CompanyIdentity,
} from "./entities";
import type { CompanyRow, FormerNameRow, TickerAliasRow } from "./schema";

export interface CompanySeed {
  companies: CompanyRow[];
  tickerAliases: TickerAliasRow[];
}

function toCompanyRow(entity: CompanyEntity): CompanyRow {
  return {
    cik: entity.cik,
    ticker: entity.ticker,
    name: entity.name,
    exchange: entity.exchange,
    sic: null,
    sic_description: null,
    entity_type: null,
    state_of_incorporation: null,
    fiscal_year_end: null,
    website: null,
    ein: null,
    former_names: [],
  };
}

function toAliasRow(alias: {
  cik: string;
  ticker: string;
  isCurrent: boolean;
  source: "sec-directory" | "separator-variant" | "submissions";
}): TickerAliasRow {
  return {
    cik: alias.cik,
    ticker: alias.ticker,
    is_current: alias.isCurrent,
    source: alias.source,
    valid_from: null,
    valid_to: null,
  };
}

/**
 * Directory-only seed: every current registrant plus separator-variant
 * aliases. Cheap — two cached SEC files, no per-company requests.
 */
export async function buildCompanySeed(): Promise<CompanySeed> {
  const [companies, aliases] = await Promise.all([
    listCompanies(),
    listTickerAliases(),
  ]);

  return {
    companies: companies.map(toCompanyRow),
    tickerAliases: aliases.map((alias) => toAliasRow(alias)),
  };
}

/**
 * Enriches one company from its submissions document: SIC, former names, and
 * every ticker EDGAR currently associates with the CIK. Costs one paced
 * EDGAR request.
 */
export function identityToSeedPatch(identity: CompanyIdentity): {
  company: Partial<CompanyRow> & { cik: string };
  tickerAliases: TickerAliasRow[];
} {
  const formerNames: FormerNameRow[] = identity.formerNames.map((entry) => ({
    name: entry.name,
    valid_from: entry.from,
    valid_to: entry.to,
  }));

  return {
    company: {
      cik: identity.cik,
      name: identity.name || undefined,
      sic: identity.sic,
      sic_description: identity.sicDescription,
      entity_type: identity.entityType,
      state_of_incorporation: identity.stateOfIncorporation,
      fiscal_year_end: identity.fiscalYearEnd,
      website: identity.website,
      ein: identity.ein,
      former_names: formerNames,
    },
    tickerAliases: aliasesFromIdentity(identity).map((alias) =>
      toAliasRow({ ...alias, source: "submissions" })
    ),
  };
}

export async function enrichCompanySeed(
  cik: string | number
): Promise<ReturnType<typeof identityToSeedPatch> | null> {
  const identity = await fetchCompanyIdentity(cik);

  return identity ? identityToSeedPatch(identity) : null;
}
