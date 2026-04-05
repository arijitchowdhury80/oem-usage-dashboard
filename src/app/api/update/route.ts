import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { resolve } from "path";

export async function POST() {
  const reportsDir = process.env.REPORTS_DIR;

  if (!reportsDir) {
    return NextResponse.json(
      { success: false, error: "REPORTS_DIR not configured" },
      { status: 403 }
    );
  }

  try {
    const projectRoot = process.cwd();
    const scriptPath = resolve(projectRoot, "scripts", "consolidate.py");

    execSync(`python3 "${scriptPath}" "${reportsDir}"`, {
      cwd: projectRoot,
      timeout: 60000,
      stdio: "pipe",
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
