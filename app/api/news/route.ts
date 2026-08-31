import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json(
      { error: "Symbol required" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/news?symbol=${encodeURIComponent(symbol)}&minId=0&token=${process.env.FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching news:", error);

    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 }
    );
  }
}