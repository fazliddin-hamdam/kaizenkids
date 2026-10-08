import { InlineKeyboard, type Bot } from 'grammy';
import { config } from '../config.js';
import * as repo from '../db/repo.js';
import type { Family, Task } from '../types.js';
import { todayKey } from '../utils/date.js';
import { bot, escapeHtml } from '../bot/bot.js';

/** API katmanının HTTP durum koduna çevirebileceği, Türkçe mesajlı iş hatası. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const CALLBACK_PATTERN = /^(approve|reject):(\d+)$/;

function childLabel(family: Family): string {
  return family.child_name ? `Çocuğunuz <b>${escapeHtml(family.child_name)}</b>,` : 'Çocuğunuz';
}

// =====================================================================
//  1) Çocuk "Yaptım!" butonuna bastı
// =====================================================================

/**
 * Çocuğun "Yaptım!" aksiyonunu işler:
 *  1. Görevi bugünün kaydında "pending" yapar (puan HENÜZ verilmez).
 *  2. Ebeveynin Telegram sohbetine Onayla / Hayır butonlu mesaj gönderir.
 *  3. Mesaj gönderilemezse (ör. ebeveyn botu engellediyse) isteği geri alır.
 */
export async function handleChildDone(family: Family, taskId: number): Promise<void> {
  const task = repo.getTask(taskId);
  if (!task) throw new AppError(404, 'Böyle bir görev bulunamadı.');

  const result = repo.requestApproval(family.id, task.id, todayKey());
  if (!result.ok) {
    throw new AppError(
      409,
      result.reason === 'ALREADY_PENDING'
        ? 'Bu görev zaten onay bekliyor. Biraz sabır! ⏳'
        : 'Bu görevi bugün zaten tamamladın! 🌟',
    );
  }

  const keyboard = new InlineKeyboard()
    .text('✅ Onayla', `approve:${result.log.id}`)
    .text('❌ Hayır, Yapmadı', `reject:${result.log.id}`);

  try {
    const message = await bot.api.sendMessage(
      family.telegram_id,
      `${childLabel(family)} '${task.emoji} <b>${escapeHtml(task.title)}</b>' görevini tamamladığını söylüyor. Onaylıyor musunuz?`,
      { parse_mode: 'HTML', reply_markup: keyboard },
    );
    repo.setApprovalMessageId(result.log.id, message.message_id);
  } catch (error) {
    console.error('Onay mesajı gönderilemedi:', error);
    repo.revertApprovalRequest(result.log.id, result.previousStatus);
    throw new AppError(
      502,
      'Annene/babana mesaj gönderilemedi. Ebeveynin bota /start yazmış olmalı. Sonra tekrar dene!',
    );
  }
}

// =====================================================================
//  2) Ebeveyn inline butona bastı (✅ Onayla / ❌ Hayır, Yapmadı)
// =====================================================================

function decisionText(family: Family, task: Task, approved: boolean): string {
  const taskName = `${task.emoji} <b>${escapeHtml(task.title)}</b>`;
  if (!approved) {
    return `❌ ${taskName} onaylanmadı.\nÇocuğunuz görevi yaptıktan sonra tekrar "Yaptım!" diyebilir.`;
  }
  const { total, inCycle, threshold, availableBoxes } = repo.getPointsSummary(family);
  const progress = availableBoxes > 0 ? '🎁 Sürpriz Kutu açılmayı bekliyor!' : `Sürpriz Kutuya ${threshold - inCycle} puan kaldı.`;
  return `✅ ${taskName} onaylandı! <b>+${task.points} puan</b> ⭐\nToplam: ${total} puan. ${progress}`;
}

/** Onay/ret callback'lerini bota kaydeder. */
export function registerApprovalHandlers(target: Bot): void {
  target.callbackQuery(CALLBACK_PATTERN, async (ctx) => {
    const [, action, idText] = ctx.match as RegExpMatchArray;
    const logId = Number(idText);

    const log = repo.getLog(logId);
    const family = log && repo.getFamilyById(log.family_id);
    if (!log || !family) {
      await ctx.answerCallbackQuery({ text: 'Bu kayıt artık bulunamıyor.' });
      return;
    }

    // Güvenlik: yalnızca ailenin ebeveyni karar verebilir (mesaj iletilse bile).
    if (ctx.from.id !== family.telegram_id) {
      await ctx.answerCallbackQuery({ text: 'Bu onayı yalnızca ebeveyn verebilir.', show_alert: true });
      return;
    }

    const result = repo.decideLog(logId, action === 'approve');
    if (!result.ok) {
      await ctx.answerCallbackQuery({ text: 'Bu görev zaten yanıtlandı.' });
      await ctx.editMessageReplyMarkup().catch(() => undefined); // eski butonları kaldır
      return;
    }

    await ctx.answerCallbackQuery({
      text: result.approved ? `Onaylandı! +${result.task.points} puan ⭐` : 'Tamam, çocuğunuz tekrar deneyebilir.',
    });
    // Mesajı sonuçla güncelle; reply_markup verilmediği için butonlar kalkar.
    await ctx
      .editMessageText(decisionText(result.family, result.task, result.approved), { parse_mode: 'HTML' })
      .catch((error) => console.warn('Onay mesajı güncellenemedi:', error));

    if (result.approved && result.boxUnlocked) {
      await ctx.reply(
        `🎉 Harika haber! ${config.boxThreshold} puana ulaşıldı ve yeni bir <b>Sürpriz Kutu</b> açıldı.\n` +
          `Çocuğunuz uygulamadan kutuyu açtığında içinden çıkan ödülü size bildireceğim. 🎁`,
        { parse_mode: 'HTML' },
      );
    }
  });
}

// =====================================================================
//  3) Sürpriz Kutu açıldığında ebeveyni bilgilendir
// =====================================================================

export async function notifyBoxOpened(family: Family, rewardTitle: string): Promise<void> {
  const who = family.child_name ? `<b>${escapeHtml(family.child_name)}</b>` : 'Çocuğunuz';
  await bot.api
    .sendMessage(
      family.telegram_id,
      `🎁 ${who} Sürpriz Kutuyu açtı!\nİçinden çıkan ödül: <b>${escapeHtml(rewardTitle)}</b>\n\nSözünüzü tutmayı unutmayın 😉`,
      { parse_mode: 'HTML' },
    )
    .catch((error) => console.warn('Kutu bildirimi gönderilemedi:', error));
}
