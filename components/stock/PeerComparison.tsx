import Link from "next/link";

import Section, { EmptyState } from "./Section";

interface PeerComparisonProps {
  peers: string[];
  industry: string | null;
}

const MAX_PEERS = 12;

/**
 * Peer tickers in the same country and sub-industry.
 *
 * Side-by-side metric comparison needs a fundamentals call per peer, which
 * would multiply API pressure, so this is navigation only for now.
 */
export default function PeerComparison({
  peers,
  industry,
}: PeerComparisonProps) {
  if (peers.length === 0) {
    return (
      <Section title="Peers">
        <EmptyState>No peer companies identified for this symbol.</EmptyState>
      </Section>
    );
  }

  return (
    <Section
      title="Peers"
      description={
        industry
          ? `Companies in ${industry}, by sub-industry classification.`
          : "Companies in the same sub-industry."
      }
    >
      <ul className="flex flex-wrap gap-2">
        {peers.slice(0, MAX_PEERS).map((peer) => (
          <li key={peer}>
            <Link
              href={`/stocks/${encodeURIComponent(peer)}`}
              className="inline-block rounded-md border border-zinc-200 px-2.5 py-1 font-mono text-sm text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            >
              {peer}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
