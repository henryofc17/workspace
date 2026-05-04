import { NextResponse } from "next/server";
import { getConfig, getConfigString } from "@/lib/config";

// ─── GET: Public config — no auth required ──────────────────────────────────
// Returns costs, limits, bonuses and WhatsApp settings so the UI can display dynamic pricing.
export async function GET() {
  try {
    const config = {
      GENERATE_COST: await getConfig("GENERATE_COST", 1),
      COPY_COST: await getConfig("COPY_COST", 3),
      TV_ACTIVATE_COST: await getConfig("TV_ACTIVATE_COST", 5),
      REGION_COST: await getConfig("REGION_COST", 3),
      CHECKER_DAILY_LIMIT: await getConfig("CHECKER_DAILY_LIMIT", 10),
      CHECKER_RESET_COST: await getConfig("CHECKER_RESET_COST", 2),
      REGISTER_BONUS: await getConfig("REGISTER_BONUS", 3),
      REFERRAL_BONUS: await getConfig("REFERRAL_BONUS", 5),
      REDEEM_BONUS: await getConfig("REDEEM_BONUS", 3),
      WHATSAPP_LINK: await getConfigString("WHATSAPP_LINK", ""),
      WHATSAPP_VISIBLE: await getConfigString("WHATSAPP_VISIBLE", "false") === "true",
    };

    return NextResponse.json({ success: true, config });
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
        REFERRAL_BONUS: 5,
        REDEEM_BONUS: 3,
        WHATSAPP_LINK: "",
        WHATSAPP_VISIBLE: false,
      },
    });
  }
}
