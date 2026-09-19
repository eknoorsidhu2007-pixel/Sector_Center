/**
 * Deterministic event classification for trader-focused ranking.
 *
 * Headline-only, on purpose: summaries on this feed are often attribution
 * stubs ("- Reuters Citing Legal Filing"), which would false-trigger the
 * regulatory patterns. Classification drives ranking weights and UI badges;
 * it never removes an article.
 *
 * Patterns run against `normalizeForMatching` output (lowercase, punctuation
 * collapsed, possessives folded). Multi-label: an article about earnings AND
 * guidance carries both; ranking uses the highest-weight match.
 */

import { normalizeForMatching } from "./text";
import type { NewsArticle, NewsEventType } from "../types";

const EVENT_PATTERNS: [NewsEventType, RegExp][] = [
  [
    "guidance",
    /\b(?:guidance|outlook|forecasts?|full[- ]year|raises? (?:its|annual|fy)|cuts? (?:its|annual|fy) (?:guidance|outlook|forecast))\b/,
  ],
  [
    "earnings",
    /\b(?:earnings?|eps|q[1-4]\b|fiscal (?:quarter|year|first|second|third|fourth)|quarterly (?:results|report)|revenue|profits?|beats? (?:estimates?|expectations?)|misses? (?:estimates?|expectations?)|top(?:s|ped)? (?:estimates?|expectations?)|bottom line)\b/,
  ],
  [
    "mna",
    /\b(?:acqui\w*|merger|buyout|takeover|stake in|spins? ?off|spinoff|divests?|to acquire|buys? \w+ for \$|sells? (?:its|stake|unit|division))\b/,
  ],
  [
    "regulatory",
    /\b(?:sec|ftc|doj|lawsuits?|sues?|sued|suing|probe|probes|investigat\w*|antitrust|fines?|fined|settlement|court|judge|regulat\w*|alleg\w*|patent|bans?|banned|class action|subpoena|trade secret|legal filing)\b/,
  ],
  [
    // A bare "CEO" mention is not a management event ("Futurum CEO Daniel
    // Newman: Apple needs to..."). Require either an explicit departure
    // phrase, an executive title near a transition verb, or a succession
    // collocation.
    "management",
    /\b(?:steps? down|stepping down)\b|\b(?:ceo|cfo|coo|cto|chief \w+|president|chairman|chairwoman)\b[^.]{0,80}\b(?:resigns?|retires?|appoints?|succeeds?|successor|succession|handoff|departs?|ousts?|ousted|fired|takes? over|leaves|leaving|exits?|replaces?d?)\b|\b(?:resigns?|retires?|appoints?|succeeds?|successor|succession|handoff|departs?|ousts?|ousted|fired|takes? over|leaves|leaving|exits?|replaces?d?)\b[^.]{0,80}\b(?:ceo|cfo|coo|cto|chief \w+|president|chairman|chairwoman)\b|\b(?:ceo|cfo|coo|cto) (?:handoff|transition|succession|search|changes?)\b|\b(?:last|final) days?\b[^.]{0,30}\b(?:ceo|cfo|coo|cto|chief \w+|president)\b/,
  ],
  [
    "analyst",
    /\b(?:upgrades?|upgraded|downgrades?|downgraded|price target|initiates?|reiterates|overweight|underweight|outperform|underperform|(?:buy|sell|hold) rating|rating (?:cut|raised|hiked)|street high|analysts? (?:say|see|eye|expect))\b/,
  ],
  [
    "capital-return",
    /\b(?:dividends?|buybacks?|share repurchase|repurchase program|capital return)\b/,
  ],
  [
    "layoffs",
    /\b(?:layoffs?|job cuts?|cuts? \d[\d,]* jobs?|cuts? jobs?|slashes? jobs?|workforce reduction|reduction in force)\b/,
  ],
  [
    "partnership",
    /\b(?:partnerships?|partners? with|teams? up|collaborat\w*|strategic (?:deal|alliance)|signs? (?:deal|pact|agreement)|agreement with)\b/,
  ],
  [
    "product",
    /\b(?:launches?|launched|unveils?|introduc\w*|debuts?|rolls? out|releases? (?:new|its)|ships|shipping|market share|new (?:iphone|ipad|mac|macbook|feature|version|model|app|service|chip|watch|subscription))\b/,
  ],
  [
    "macro",
    /\b(?:fed\b|interest rates?|inflation|cpi|jobs report|treasur\w+|tariffs?|recession|oil (?:rises|falls|prices)|iran|ukraine|russia|stock futures|markets? (?:fall|rise|slump|rout)|sell[- ]off|wall street)\b/,
  ],
  [
    "opinion",
    /\b(?:versus peers|compared to (?:its )?competitors|insights into|understanding \w+ position|why i|doesnt concern|heres what|what to know|should you (?:buy|sell)|is it too late|cramer)\b/,
  ],
];

/** Highest-weight first; ranking and badge display both rely on this order. */
export const EVENT_WEIGHTS: Record<NewsEventType, number> = {
  earnings: 10,
  guidance: 10,
  mna: 9,
  regulatory: 8,
  management: 8,
  analyst: 7,
  product: 6,
  partnership: 6,
  "capital-return": 6,
  layoffs: 5,
  opinion: 3,
  macro: 2,
  other: 4,
};

export function classifyArticle(
  article: Pick<NewsArticle, "headline">
): NewsEventType[] {
  const normalized = normalizeForMatching(article.headline);
  const matches: NewsEventType[] = [];

  for (const [type, pattern] of EVENT_PATTERNS) {
    if (pattern.test(normalized)) {
      matches.push(type);
    }
  }

  if (matches.length === 0) {
    return ["other"];
  }

  matches.sort((a, b) => EVENT_WEIGHTS[b] - EVENT_WEIGHTS[a]);

  return matches;
}

export interface ClassifiedArticle extends NewsArticle {
  eventTypes: NewsEventType[];
}
