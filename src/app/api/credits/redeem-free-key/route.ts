import { NextResponse } from "next/server";

// Disabled — feature temporarily unavailable
export async function POST() {
  return NextResponse.json({ success: false, error: "Funcion temporalmente deshabilitada" }, { status: 403 });
}