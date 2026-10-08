import { Bot } from 'grammy';
import { config } from '../config.js';

/** Tek bot örneği. Hem bot komutları hem de API (onay mesajı gönderimi) bunu kullanır. */
export const bot = new Bot(config.botToken);

/** Telegram HTML parse_mode için kullanıcı metnini güvenli hale getirir. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
