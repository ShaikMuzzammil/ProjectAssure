import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() { return NextResponse.json({ ok: true, service: "projectassure-host-control", version: "v17", timestamp: new Date().toISOString() }); }
