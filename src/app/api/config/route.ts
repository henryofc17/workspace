import { NextResponse } from "next/server";
import { getConfig, getConfigString } from "@/lib/config";

// ─── GET: Public config — no auth required ──────────────────────────────────
// Returns costs, limits, bonuses and WhatsApp settings so the UI can display dynamic pricing.
export async function GET() {
  try {
    const config = await Promise.all([
      getConfig("GENERATE_COST", 1),
      getConfig("COPY_COST", 3),
      getConfig("TV_ACTIVATE_COST", 5),
      getConfig("REGION_COST", 3),
      getConfig("CHECKER_DAILY_LIMIT", 10),
      getConfig("CHECKER_RESET_COST", 2),
      getConfig("REGISTER_BONUS", 3),
      getConfig("REFERRER_CREDIT", 3),
      getConfig("REFERRED_CREDIT", 2),
      getConfigString("WHATSAPP_LINK", ""),
      getConfigString("WHATSAPP_VISIBLE", "false"),
    ]);

    const configObj = {
      GENERATE_COST: config[0],
      COPY_COST: config[1],
      TV_ACTIVATE_COST: config[2],
      REGION_COST: config[3],
      CHECKER_DAILY_LIMIT: config[4],
      CHECKER_RESET_COST: config[5],
      REGISTER_BONUS: config[6],
      REFERRER_CREDIT: config[7],
      REFERRED_CREDIT: config[8],
      WHATSAPP_LINK: config[9],
      WHATSAPP_VISIBLE: config[10] === "true",
    };

    return NextResponse.json(
      { success: true, config: configObj },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch {
    // Fallback defaults if DB is unreachable
    return NextResponse.json({
      success: true,
      config: {
        GENERATE_COST: 1,
        COPY_COST: 3,
        TV_ACTIVATE_COST: 5,
        REGION_COST: 3,
        CHECKER_DAILY_LIMIT: 10,
        CHECKER_RESET_COST: 2,
        REGISTER_BONUS: 3,
        REFERRER_CREDIT: 3,
        REFERRED_CREDIT: 2,
        WHATSAPP_LINK: "",
        WHATSAPP_VISIBLE: false,
      },
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  }
}
