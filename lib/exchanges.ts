/**
 * Market Identifier Code (MIC) to display label.
 *
 * Finnhub's symbol search endpoint does not return an exchange, but the bulk
 * `/stock/symbol` listing returns a MIC, which is how we can label results
 * "NASDAQ" or "NYSE" instead of showing a raw code.
 */

const MIC_LABELS: Record<string, string> = {
  XNAS: "NASDAQ",
  XNGS: "NASDAQ",
  XNCM: "NASDAQ",
  XNMS: "NASDAQ",
  XNYS: "NYSE",
  XASE: "NYSE American",
  ARCX: "NYSE Arca",
  BATS: "Cboe BZX",
  BATY: "Cboe BYX",
  EDGA: "Cboe EDGA",
  EDGX: "Cboe EDGX",
  IEXG: "IEX",
  XCIS: "NYSE National",
  OTCM: "OTC Markets",
  OOTC: "OTC",
};

const OTC_MICS = new Set(["OTCM", "OOTC", "PSGM", "PINX"]);

export function exchangeLabelFromMic(mic: string | undefined): string {
  if (!mic) {
    return "US";
  }

  return MIC_LABELS[mic.toUpperCase()] ?? mic.toUpperCase();
}

/**
 * Sort tier for search results: 0 = major exchange, 1 = unrecognised, 2 = OTC.
 *
 * Without this, "apple" surfaces OTC shells such as APPLE RUSH CO above
 * NYSE-listed APPLE HOSPITALITY REIT, because both match the name equally well.
 */
export function exchangeTierFromMic(mic: string | undefined): number {
  if (!mic) {
    return 1;
  }

  const upper = mic.toUpperCase();

  if (OTC_MICS.has(upper)) {
    return 2;
  }

  return upper in MIC_LABELS ? 0 : 1;
}
