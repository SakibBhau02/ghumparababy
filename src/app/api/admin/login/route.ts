import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  createToken,
  safeEqual,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = (await req.json()) as {
      username?: string;
      password?: string;
    };

    const validUser = (process.env.ADMIN_USERNAME ?? "admin").trim();
    const validPass = (process.env.ADMIN_PASSWORD ?? "").trim();

    // Server misconfiguration (env missing on Vercel etc.) — visible in runtime logs
    // and surfaced to the login form as an actionable hint (not the password itself).
    if (!validPass) {
      console.error(
        "ADMIN LOGIN MISCONFIGURED: ADMIN_PASSWORD is empty. Set it in Vercel → Project → Settings → Environment Variables, then redeploy."
      );
      return NextResponse.json(
        {
          error:
            "সার্ভারে অ্যাডমিন পাসওয়ার্ড সেট করা নেই। Vercel → Settings → Environment Variables-এ ADMIN_PASSWORD বসিয়ে Redeploy করুন।",
          code: "misconfigured",
        },
        { status: 503 }
      );
    }

    if (
      !username ||
      !password ||
      !safeEqual(username.trim(), validUser) ||
      !safeEqual(password.trim(), validPass)
    ) {
      return NextResponse.json(
        { error: "ভুল ইউজারনেম বা পাসওয়ার্ড।", code: "invalid" },
        { status: 401 }
      );
    }

    const res = NextResponse.json({ ok: true });
    // Behind HTTPS proxies (Vercel) the request itself is HTTP — decide the
    // Secure flag from the forwarded protocol so the cookie always sticks.
    const forwardedProto = req.headers.get("x-forwarded-proto");
    const isHttps = forwardedProto
      ? forwardedProto.split(",")[0].trim().toLowerCase() === "https"
      : process.env.NODE_ENV === "production";
    res.cookies.set(ADMIN_COOKIE, createToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return res;
  } catch {
    return NextResponse.json(
      { error: "সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
