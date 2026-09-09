/**
 * Pure (client-safe) Telegram order-alert config — NO server imports here.
 * Server-side read/write + sending live in src/lib/telegram.ts.
 *
 * Setup (admin panel, one time): paste the BotFather token + the chat ID,
 * press "Connect" — the server validates via getMe/getChat and saves.
 * From then on every NEW order posts full details + product photos to
 * that chat automatically.
 */

export type TelegramConfig = {
  enabled: boolean;
  botToken: string;
  chatId: string;
  /** @BotFather username of the connected bot (filled on Connect). */
  botUsername: string;
};

export const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
  enabled: false,
  botToken: "",
  chatId: "",
  botUsername: "",
};

const MAX_LEN: Record<keyof Omit<TelegramConfig, "enabled">, number> = {
  botToken: 128,
  chatId: 64,
  botUsername: 64,
};

/** Sanitize anything coming from DB/admin into a valid TelegramConfig. */
export function sanitizeTelegramConfig(input: unknown): TelegramConfig | null {
  if (!input || typeof input !== "object") return null;
  const rec = input as Record<string, unknown>;
  const str = (k: keyof typeof MAX_LEN): string => {
    const v = rec[k];
    if (typeof v !== "string") return "";
    return v.trim().slice(0, MAX_LEN[k]);
  };
  return {
    enabled: rec.enabled === true,
    botToken: str("botToken"),
    chatId: str("chatId"),
    botUsername: str("botUsername"),
  };
}

/** Ready to actually send (enabled + token + chat present). */
export function isTelegramReady(config: TelegramConfig): boolean {
  return (
    config.enabled &&
    config.botToken.length > 0 &&
    config.chatId.length > 0
  );
}
