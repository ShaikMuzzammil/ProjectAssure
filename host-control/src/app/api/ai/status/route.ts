import { NextResponse } from "next/server";
import { probeProviderStatus } from "@/lib/host/ai";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(await probeProviderStatus()); }
