import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import {
  checkChat,
  getBotInfo,
  isSelfChat,
  saveTelegramConfig,
} from "@/lib/telegram";

/**
 * POST /api/admin/telegram/connect — { botToken, chatId }
 * Validates the token via getMe AND confirms the bot can reach the chat
 * via getChat, then saves + enables. One click: paste → Connect → done.
 */
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }
  try {
    const { botToken, chatId } = (await req.json()) as {
      botToken?: unknown;
      chatId?: unknown;
    };
    const token = typeof botToken === "string" ? botToken.trim() : "";
    const chat = typeof chatId === "string" ? chatId.trim() : "";
    if (!token || !chat) {
      return NextResponse.json(
        { error: "Bot Token ও Chat ID দুটোই দিন।" },
        { status: 400 }
      );
    }

    const info = await getBotInfo(token);
    if (!info.ok) {
      return NextResponse.json({ error: info.error }, { status: 400 });
    }

    // Bots can never message themselves — catch it here with a clear
    // message instead of a cryptic 403 later.
    if (isSelfChat(chat, info.bot)) {
      return NextResponse.json(
        {
          error:
            "Chat ID-টা bot-এর নিজের মনে হচ্ছে (bot নিজেকে মেসেজ পাঠাতে পারে না)। Token-এর সামনের সংখ্যা Chat ID নয় — @userinfobot থেকে আপনার নিজের ID নিন (গাইডের ধাপ ২)।",
        },
        { status: 400 }
      );
    }

    const chatCheck = await checkChat(token, chat);
    if (!chatCheck.ok) {
      return NextResponse.json({ error: chatCheck.error }, { status: 400 });
    }

    const config = {
      enabled: true,
      botToken: token,
      chatId: chat,
      botUsername: info.bot.username,
    };
    await saveTelegramConfig(config);
    return NextResponse.json({ ok: true, telegram: config, bot: info.bot });
  } catch {
    return NextResponse.json(
      { error: "কানেক্ট করা যায়নি। আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
