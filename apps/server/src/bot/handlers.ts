import { InlineKeyboard, type Bot, type Context } from 'grammy';
import { config, hasValidWebAppUrl } from '../config.js';
import * as repo from '../db/repo.js';
import { registerApprovalHandlers } from '../services/approval.js';
import type { Family, LogStatus } from '../types.js';
import { todayKey } from '../utils/date.js';
import { escapeHtml } from './bot.js';

const HELP_TEXT = [
  '<b>KaizenKids Komutları</b> 🌱',
  '',
  '/start — Uygulamayı aç',
  '/isim <i>Ad</i> — Çocuğunuzun adını ayarla (ör. <code>/isim Ali</code>)',
  '/durum — Bugünkü görevler ve puan durumu',
  '/oduller — Sürpriz Kutu ödüllerini listele',
  '/odulekle <i>metin</i> — Yeni ödül ekle (ör. <code>/odulekle Sinema gecesi</code>)',
  '/odulsil <i>numara</i> — Ödülü sil (numara /oduller listesindeki sıradır)',
  '/yardim — Bu mesaj',
].join('\n');

const STATUS_ICON: Record<LogStatus | 'todo', string> = {
  todo: '⬜️',
  pending: '⏳',
  approved: '✅',
  rejected: '🔁',
};

function familyOf(ctx: Context): Family {
  return repo.getOrCreateFamily(ctx.from!.id, ctx.from!.first_name);
}

function openAppKeyboard(): InlineKeyboard | undefined {
  return hasValidWebAppUrl ? new InlineKeyboard().webApp('🚀 KaizenKids\'i Aç', config.webAppUrl) : undefined;
}

export function registerBotHandlers(bot: Bot): void {
  // Bot yalnızca özel sohbetlerde çalışır (bir aile = bir ebeveyn sohbeti).
  const pm = bot.chatType('private');

  pm.command('start', async (ctx) => {
    const family = familyOf(ctx);
    const name = family.child_name ? escapeHtml(family.child_name) : 'çocuğunuz';
    await ctx.reply(
      [
        `Merhaba ${escapeHtml(ctx.from.first_name)}! 👋 <b>KaizenKids</b>'e hoş geldiniz.`,
        '',
        `Her gün %1 daha iyi! 🌱 Uygulamayı ${name} için açın; görevini tamamladığında "Yaptım!" diyecek, ` +
          'ben de onaylamanız için size buraya mesaj atacağım.',
        '',
        `⭐ Onaylanan görevler puan kazandırır, her ${config.boxThreshold} puanda bir 🎁 <b>Sürpriz Kutu</b> açılır.`,
        family.child_name ? '' : '\n👉 Önce çocuğunuzun adını ayarlayın: <code>/isim Ali</code>',
        '',
        'Tüm komutlar için: /yardim',
      ].join('\n'),
      { parse_mode: 'HTML', reply_markup: openAppKeyboard() },
    );
    if (hasValidWebAppUrl) {
      await setChatMenuButton(bot, ctx.chat.id);
    } else {
      await ctx.reply('⚠️ WEBAPP_URL ayarlı değil (HTTPS olmalı). Mini App butonu gösterilemiyor.');
    }
  });

  pm.command(['yardim', 'help'], (ctx) => ctx.reply(HELP_TEXT, { parse_mode: 'HTML' }));

  pm.command('isim', async (ctx) => {
    const name = ctx.match.trim().slice(0, 30);
    if (!name) {
      await ctx.reply('Lütfen bir isim yazın. Örnek: /isim Ali');
      return;
    }
    const family = familyOf(ctx);
    repo.setChildName(family.id, name);
    await ctx.reply(`Tamamdır! Uygulama artık <b>${escapeHtml(name)}</b> için hazır. 🎉`, {
      parse_mode: 'HTML',
      reply_markup: openAppKeyboard(),
    });
  });

  pm.command('durum', async (ctx) => {
    const family = familyOf(ctx);
    const today = todayKey();
    const statusByTask = new Map(repo.getLogsForDate(family.id, today).map((l) => [l.task_id, l.status]));
    const lines = repo
      .listTasksForDate(today)
      .map((t) => `${STATUS_ICON[statusByTask.get(t.id) ?? 'todo']} ${t.emoji} ${escapeHtml(t.title)} (+${t.points})`);
    const points = repo.getPointsSummary(family);
    const streak = repo.getStreak(family.id, today);

    await ctx.reply(
      [
        `<b>Bugünün Durumu</b> (${today})`,
        '',
        ...lines,
        '',
        `⭐ Toplam puan: <b>${points.total}</b>`,
        points.availableBoxes > 0
          ? `🎁 Açılmayı bekleyen kutu: <b>${points.availableBoxes}</b>`
          : `🎁 Sürpriz Kutuya ${points.threshold - points.inCycle} puan kaldı`,
        `🔥 Seri: ${streak} gün`,
        '',
        '⬜️ yapılmadı · ⏳ onay bekliyor · ✅ onaylandı · 🔁 reddedildi',
      ].join('\n'),
      { parse_mode: 'HTML' },
    );
  });

  pm.command('oduller', async (ctx) => {
    const rewards = repo.listActiveRewards(familyOf(ctx).id);
    if (rewards.length === 0) {
      await ctx.reply('Henüz ödül yok. Eklemek için: /odulekle Sinema gecesi');
      return;
    }
    const list = rewards.map((r, i) => `${i + 1}. ${escapeHtml(r.title)}`).join('\n');
    await ctx.reply(`<b>🎁 Sürpriz Kutu Ödülleri</b>\n\n${list}\n\nSilmek için: /odulsil 2`, { parse_mode: 'HTML' });
  });

  pm.command('odulekle', async (ctx) => {
    const title = ctx.match.trim().slice(0, 80);
    if (!title) {
      await ctx.reply('Lütfen ödülü yazın. Örnek: /odulekle Parkta yarım saat ekstra oyun');
      return;
    }
    repo.addReward(familyOf(ctx).id, title);
    await ctx.reply(`✅ Ödül eklendi: <b>${escapeHtml(title)}</b>`, { parse_mode: 'HTML' });
  });

  pm.command('odulsil', async (ctx) => {
    const family = familyOf(ctx);
    const index = Number(ctx.match.trim()) - 1;
    const reward = repo.listActiveRewards(family.id)[index];
    if (!reward) {
      await ctx.reply('Geçersiz numara. Önce /oduller ile listeye bakın.');
      return;
    }
    repo.deactivateReward(family.id, reward.id);
    await ctx.reply(`🗑️ Ödül silindi: <b>${escapeHtml(reward.title)}</b>`, { parse_mode: 'HTML' });
  });

  registerApprovalHandlers(bot);

  bot.catch((err) => console.error('Bot hatası:', err.error));
}

/** Komut menüsünü ve sohbetteki "menü butonu"nu (Mini App kısayolu) ayarlar. */
export async function configureBotProfile(bot: Bot): Promise<void> {
  await bot.api.setMyCommands([
    { command: 'start', description: 'Uygulamayı aç' },
    { command: 'durum', description: 'Bugünkü görevler ve puanlar' },
    { command: 'isim', description: 'Çocuğun adını ayarla' },
    { command: 'oduller', description: 'Sürpriz Kutu ödülleri' },
    { command: 'odulekle', description: 'Yeni ödül ekle' },
    { command: 'odulsil', description: 'Ödül sil' },
    { command: 'yardim', description: 'Yardım' },
  ]);

  if (!hasValidWebAppUrl) return;

  await setChatMenuButton(bot);
  // Telegram, botun varsayılan menü butonu değişikliğini mevcut sohbetlere geç (bazen hiç)
  // yansıtıyor. Tünel adresi her açılışta değiştiği için butonu her ebeveyn sohbetine ayrıca yazıyoruz.
  for (const family of repo.listFamilies()) {
    await setChatMenuButton(bot, family.telegram_id);
  }
}

/** chatId verilirse yalnızca o sohbetin, verilmezse botun varsayılan menü butonunu ayarlar. */
async function setChatMenuButton(bot: Bot, chatId?: number): Promise<void> {
  await bot.api
    .setChatMenuButton({
      chat_id: chatId,
      menu_button: { type: 'web_app', text: 'KaizenKids', web_app: { url: config.webAppUrl } },
    })
    .catch((error) => console.warn(`Menü butonu ayarlanamadı (${chatId ?? 'varsayılan'}):`, error.message));
}
