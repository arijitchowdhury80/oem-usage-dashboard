import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

export async function GET() {
  const dataPath = resolve(process.cwd(), "data", "adobe_oem_consolidated.json");

  if (!existsSync(dataPath)) {
    return NextResponse.json(
      { error: "Data file not found. Run 'npm run process' or 'npm run watch' first." },
      { status: 404 }
    );
  }

  const raw = readFileSync(dataPath, "utf-8");
  const data = JSON.parse(raw);

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
  });
}
