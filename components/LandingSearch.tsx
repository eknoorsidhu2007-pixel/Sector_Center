"use client";

import { useRouter } from "next/navigation";

import CompanySearch from "@/components/CompanySearch";
import type { CompanyMatch } from "@/lib/types";

export default function LandingSearch() {
  const router = useRouter();

  const handleSelect = (company: CompanyMatch) => {
    router.push(`/stocks/${encodeURIComponent(company.symbol)}`);
  };

  return (
    <CompanySearch
      onSelect={handleSelect}
      selectedSymbol=""
      selectedCompany={null}
    />
  );
}