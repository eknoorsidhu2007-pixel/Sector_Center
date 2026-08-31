import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();

  if (!symbol) {
    return NextResponse.json(
      { error: "Symbol required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    console.error("FINNHUB_API_KEY is not configured");

    return NextResponse.json(
      { error: "Finnhub API key is not configured" },
      { status: 500 }
    );
  }

  try {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 7);

    const formatDate = (date: Date) => {
      return date.toISOString().split("T")[0];
    };

    const response = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(
        symbol
      )}&from=${formatDate(from)}&to=${formatDate(today)}&token=${apiKey}`,
      {
        next: {
          revalidate: 300,
        },
      }
    );

    if (!response.ok) {
      console.error(
        "Finnhub API error:",
        response.status,
        response.statusText
      );

      return NextResponse.json(
        { error: "Finnhub API request failed" },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      return NextResponse.json(
        { error: "Invalid response from Finnhub" },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching news:", error);

    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 }
    );
  }
}