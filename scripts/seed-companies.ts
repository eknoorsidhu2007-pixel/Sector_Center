/**
 * One-off SEC company-identity seed.
 *
 * Usage:
 *   npm run research:seed-companies
 *
 * Not called from /stocks/[symbol]. Not a scheduler.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { resolveCik } from "../lib/research/entities";
import {
  countStoredIdentity,
  findStoredCompanyByTicker,
  persistCompanySeed,
} from "../lib/research/persist";
import { buildCompanySeed } from "../lib/research/seed";

const EXPECTED_AAPL_CIK = "0000320193";

/** Loads `.env.local` without adding a dotenv dependency. Existing env wins. */
function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  let text: string;

  try {
    text = readFileSync(envPath, "utf8");
  } catch {
    return;
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1);

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

function requireEnv(name: string, hint: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured. ${hint}`);
  }

  return value;
}

function requireResearchEnv(): void {
  requireEnv(
    "SEC_USER_AGENT",
    "EDGAR requires a User-Agent that identifies you with contact information. Set it in .env.local, e.g. SEC_USER_AGENT=\"Sector Center you@example.com\". Do not invent a placeholder."
  );
  requireEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    "Set the Supabase project URL in .env.local."
  );
  requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "Set the server-only service-role key in .env.local. Never expose it to the browser."
  );
}

async function main(): Promise<void> {
  loadEnvLocal();
  requireResearchEnv();

  console.log("Building SEC company directory…");
  const seed = await buildCompanySeed();
  console.log(
    `Seed built: ${seed.companies.length} listing rows, ${seed.tickerAliases.length} aliases`
  );

  const memoryApple = await resolveCik("AAPL");
  console.log(
    memoryApple
      ? `In-memory AAPL → CIK ${memoryApple.cik} (${memoryApple.name})`
      : "In-memory AAPL did not resolve"
  );

  const before = await countStoredIdentity();
  const written = await persistCompanySeed(seed);
  const after = await countStoredIdentity();

  const storedApple = await findStoredCompanyByTicker("AAPL");

  console.log(
    `Upserted ${written.companiesWritten} companies and ${written.aliasesWritten} aliases`
  );
  console.log(
    `Table counts: companies ${before.companies} → ${after.companies}, aliases ${before.aliases} → ${after.aliases}`
  );

  if (!storedApple) {
    throw new Error("AAPL was not found in stored company identity");
  }

  console.log(
    `Stored AAPL → CIK ${storedApple.cik} (${storedApple.name}, primary ${storedApple.ticker})`
  );

  if (storedApple.cik !== EXPECTED_AAPL_CIK) {
    throw new Error(
      `Stored AAPL CIK was ${storedApple.cik}, expected ${EXPECTED_AAPL_CIK}`
    );
  }

  if (memoryApple && memoryApple.cik !== storedApple.cik) {
    throw new Error(
      `Stored AAPL CIK ${storedApple.cik} does not match in-memory ${memoryApple.cik}`
    );
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
