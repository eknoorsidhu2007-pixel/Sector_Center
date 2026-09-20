/**
 * Form 3/4/5 ownership XML parser.
 *
 * Finnhub's free insider endpoint often omits or flattens `transactionCode`.
 * That code is the whole signal: P and S are open-market conviction trades,
 * while A/M/F are compensation mechanics. This module reads the raw EDGAR
 * ownership document and keeps the code on every row.
 *
 * No XML library: Form 4's schema is small and stable, and adding a parser
 * dependency is not worth it for one document type.
 */

import type { InsiderTransaction, InsiderTransactionKind } from "../market/types";
import {
  accessionPath,
  fetchArchiveDocument,
  fetchArchiveIndex,
  fetchSubmissions,
  padCik,
} from "./sec-client";

const OWNERSHIP_FORMS = new Set(["3", "4", "5", "3/A", "4/A", "5/A"]);

export interface Form4Transaction {
  accessionNumber: string | null;
  issuerCik: string | null;
  issuerTicker: string | null;
  reporterName: string;
  reporterCik: string | null;
  /** Raw SEC code, always preserved when the XML had one. */
  transactionCode: string;
  kind: InsiderTransactionKind;
  isDerivative: boolean;
  /** Signed share delta: acquired is positive, disposed is negative. */
  change: number | null;
  sharesHeld: number | null;
  price: number | null;
  value: number | null;
  transactionDate: string | null;
  securityTitle: string | null;
}

/**
 * Maps an SEC transaction code to a semantic kind.
 *
 * Only P and S are open-market conviction trades. Treating every acquisition
 * as "buying" is the most common way insider data gets misreported.
 */
export function classifyTransactionCode(code: string | null): InsiderTransactionKind {
  if (!code) {
    return "other";
  }

  switch (code.trim().toUpperCase()) {
    case "P":
      return "open-market-buy";
    case "S":
      return "open-market-sell";
    case "A":
      return "grant";
    case "M":
    case "X":
    case "C":
      return "option-exercise";
    case "F":
    case "D":
      return "tax-or-disposition";
    case "G":
      return "gift";
    default:
      return "other";
  }
}

export function toInsiderTransaction(
  row: Form4Transaction,
  filingDate: string | null = null
): InsiderTransaction {
  return {
    name: row.reporterName,
    transactionCode: row.transactionCode,
    kind: row.kind,
    isDerivative: row.isDerivative,
    change: row.change,
    sharesHeld: row.sharesHeld,
    price: row.price,
    value: row.value,
    transactionDate: row.transactionDate,
    filingDate,
    currency: "USD",
  };
}

// -- XML helpers ---------------------------------------------------------------

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCharCode(Number.parseInt(dec, 10))
    );
}

function ownershipRoot(xml: string): string {
  const match = xml.match(/<ownershipDocument[\s\S]*?<\/ownershipDocument>/i);

  return match ? match[0] : xml;
}

function blocks(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi");
  const found: string[] = [];

  for (const match of xml.matchAll(pattern)) {
    if (match[1]) {
      found.push(match[1]);
    }
  }

  return found;
}

function firstBlock(xml: string, tag: string): string | null {
  return blocks(xml, tag)[0] ?? null;
}

/**
 * Reads a Form 4 value. The schema wraps most fields in `<value>`; a few
 * codes (transactionCode) sit directly in the tag.
 */
function taggedValue(xml: string, tag: string): string | null {
  const inner = firstBlock(xml, tag);

  if (inner === null) {
    return null;
  }

  const wrapped = firstBlock(inner, "value");
  const raw = (wrapped ?? inner).replace(/<[^>]+>/g, "").trim();

  if (!raw) {
    return null;
  }

  return decodeEntities(raw);
}

function taggedNumber(xml: string, tag: string): number | null {
  const raw = taggedValue(xml, tag);

  if (raw === null) {
    return null;
  }

  const value = Number.parseFloat(raw.replace(/,/g, ""));

  return Number.isFinite(value) ? value : null;
}

function parseOneTransaction(
  xml: string,
  isDerivative: boolean,
  issuerCik: string | null,
  issuerTicker: string | null,
  reporterName: string,
  reporterCik: string | null,
  accessionNumber: string | null
): Form4Transaction | null {
  const code = taggedValue(xml, "transactionCode");

  // Holdings have no code. A row without one is not a transaction.
  if (!code) {
    return null;
  }

  const shares = taggedNumber(xml, "transactionShares");
  const acquiredDisposed = taggedValue(xml, "transactionAcquiredDisposedCode");
  let change: number | null = shares;

  if (change !== null && acquiredDisposed) {
    const flag = acquiredDisposed.trim().toUpperCase();

    if (flag === "D") {
      change = -Math.abs(change);
    } else if (flag === "A") {
      change = Math.abs(change);
    }
  }

  const price = taggedNumber(xml, "transactionPricePerShare");

  return {
    accessionNumber,
    issuerCik,
    issuerTicker,
    reporterName,
    reporterCik,
    transactionCode: code.trim().toUpperCase(),
    kind: classifyTransactionCode(code),
    isDerivative,
    change,
    sharesHeld: taggedNumber(xml, "sharesOwnedFollowingTransaction"),
    price,
    value:
      change !== null && price !== null ? Math.abs(change) * price : null,
    transactionDate: taggedValue(xml, "transactionDate"),
    securityTitle: taggedValue(xml, "securityTitle"),
  };
}

/**
 * Parses one ownership XML document into individual transactions.
 * Holdings (no transactionCode) are dropped; they are not trades.
 */
export function parseOwnershipXml(
  xml: string,
  accessionNumber: string | null = null
): Form4Transaction[] {
  const root = ownershipRoot(xml);
  const issuerCik = taggedValue(root, "issuerCik");
  const issuerTicker = taggedValue(root, "issuerTradingSymbol");
  const reporterName = taggedValue(root, "rptOwnerName") ?? "Unknown insider";
  const reporterCik = taggedValue(root, "rptOwnerCik");

  const rows: Form4Transaction[] = [];

  const tables: { tag: string; derivative: boolean }[] = [
    { tag: "nonDerivativeTransaction", derivative: false },
    { tag: "derivativeTransaction", derivative: true },
  ];

  for (const { tag, derivative } of tables) {
    for (const block of blocks(root, tag)) {
      const row = parseOneTransaction(
        block,
        derivative,
        issuerCik,
        issuerTicker,
        reporterName,
        reporterCik,
        accessionNumber
      );

      if (row) {
        rows.push(row);
      }
    }
  }

  return rows;
}

function pickOwnershipXmlFilename(
  names: string[],
  primaryDocument: string | null
): string | null {
  const xmlNames = names.filter(
    (name) =>
      name.toLowerCase().endsWith(".xml") &&
      !name.toLowerCase().startsWith("xsl") &&
      !name.toLowerCase().includes("/")
  );

  const form4 = xmlNames.find((name) => /form4|ownership|wk-form/i.test(name));

  if (form4) {
    return form4;
  }

  if (xmlNames[0]) {
    return xmlNames[0];
  }

  if (primaryDocument && primaryDocument.toLowerCase().endsWith(".xml")) {
    return primaryDocument.replace(/^.*\//, "");
  }

  return null;
}

interface RecentFilings {
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      form?: string[];
      primaryDocument?: string[];
    };
  };
}

export interface OwnershipFilingRef {
  accessionNumber: string;
  form: string;
  filingDate: string | null;
  primaryDocument: string | null;
}

/** Recent Form 3/4/5 accessions from the submissions index. */
export function listOwnershipFilings(
  submissions: RecentFilings,
  limit = 20
): OwnershipFilingRef[] {
  const recent = submissions.filings?.recent;
  const accessions = recent?.accessionNumber ?? [];
  const forms = recent?.form ?? [];
  const dates = recent?.filingDate ?? [];
  const documents = recent?.primaryDocument ?? [];
  const refs: OwnershipFilingRef[] = [];

  for (let index = 0; index < accessions.length; index += 1) {
    const form = forms[index]?.trim() ?? "";

    if (!OWNERSHIP_FORMS.has(form)) {
      continue;
    }

    const accessionNumber = accessions[index]?.trim();

    if (!accessionNumber) {
      continue;
    }

    refs.push({
      accessionNumber,
      form,
      filingDate: dates[index]?.trim() || null,
      primaryDocument: documents[index]?.trim() || null,
    });

    if (refs.length >= limit) {
      break;
    }
  }

  return refs;
}

/**
 * Fetches and parses recent Form 3/4/5 filings for a CIK. Each XML is paced
 * through the SEC client queue. Callers should cache the result; this is not
 * cheap enough to run on every stock-page render.
 */
export async function fetchRecentForm4Transactions(
  cik: string | number,
  limit = 8
): Promise<Form4Transaction[]> {
  const submissions = await fetchSubmissions<RecentFilings>(cik);

  if (!submissions) {
    return [];
  }

  const filings = listOwnershipFilings(submissions, limit);
  const padded = padCik(cik);
  const rows: Form4Transaction[] = [];

  for (const filing of filings) {
    const names = await fetchArchiveIndex(padded, filing.accessionNumber);
    const filename = pickOwnershipXmlFilename(names, filing.primaryDocument);

    if (!filename) {
      continue;
    }

    const xml = await fetchArchiveDocument(
      padded,
      filing.accessionNumber,
      filename
    );

    if (!xml) {
      continue;
    }

    rows.push(
      ...parseOwnershipXml(xml, filing.accessionNumber).map((row) => ({
        ...row,
        issuerCik: row.issuerCik ?? padded,
      }))
    );
  }

  return rows;
}

/** Used by callers that already know the accession and filename. */
export async function parseArchiveForm4(
  cik: string | number,
  accessionNumber: string,
  filename?: string
): Promise<Form4Transaction[]> {
  const resolved =
    filename ??
    pickOwnershipXmlFilename(
      await fetchArchiveIndex(cik, accessionNumber),
      null
    );

  if (!resolved) {
    return [];
  }

  const xml = await fetchArchiveDocument(cik, accessionNumber, resolved);

  return xml ? parseOwnershipXml(xml, accessionNumber) : [];
}

export function form4CacheKey(cik: string, accessionNumber: string): string {
  return `form4:${padCik(cik)}:${accessionPath(accessionNumber)}`;
}
