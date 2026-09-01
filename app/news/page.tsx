import type { Metadata } from "next";

import NewsExplorer from "@/components/NewsExplorer";
import { normalizeSymbol } from "@/lib/validation";

const DEFAULT_SYMBOL = "AAPL";

export const metadata: Metadata = {
  title: "Company news — Sector Center",
  description:
    "Search any listed company and read its latest news coverage.",
};

export default async function NewsPage(props: PageProps<"/news">) {
  const searchParams = await props.searchParams;
  const requested = searchParams.symbol;
  const candidate = Array.isArray(requested) ? requested[0] : requested;

  return (
    <NewsExplorer initialSymbol={normalizeSymbol(candidate) ?? DEFAULT_SYMBOL} />
  );
}
