import { NextResponse } from "next/server";

import { getAssetsByOwner } from "@/lib/api/helius";

const TEST_WALLET = "CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq";

export async function GET() {
  try {
    const response = await getAssetsByOwner(TEST_WALLET);
    return NextResponse.json({ total: response.total });
  } catch (error) {
    console.error("Helius API route error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: message },
      {
        status: 502,
      }
    );
  }
}
