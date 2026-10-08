import { InlineKeyboard, type Bot, type Context } from 'grammy';
import { config, hasValidWebAppUrl } from '../config.js';
import * as repo from '../db/repo.js';
import { MAX_CHILDREN } from '../db/schema.js';
import { registerApprovalHandlers } from '../services/approval.js';
import type { Child, Family, Gender, LogStatus, RewardKind } from '../types.js';
import { todayKey } from '../utils/date.js';
import { escapeHtml } from './bot.js';

const HELP_TEXT = [
  '<b>KaizenKids Komutları</b> 🌱',
  '',
  '<b>Çocuklar</b>',
  '/isim <i>Ad</i> — Çocuk ekle, ardından cinsiyet sorulur (ör. <code>/isim Ali</code> ya da <code>/isim Ayşe kız</code>)',
  '/cinsiyet <i>numara</i> — Çocuğun cinsiyetini seç/değiştir',
  '/cocuklar — Çocukları listele',
  '/isimdegistir <i>numara Ad</i> — Adı değiştir (ör. <code>/isimdegistir 2 Elif</code>)',
  '/cocuksil <i>numara</i> — Çocuğu listeden kaldır (veriler saklanır)',
  '',
  '<b>Takip</b>',
  '/durum — Tüm çocukların bugünkü özeti',
  '/durum <i>numara</i> — Bir çocuğun görev listesi (ör. <code>/durum 1</code>)',
  '',
  `<b>🎁 Sürpriz Kutu</b> (her ${config.boxThreshold} puanda; tüm çocuklar için ortak liste)`,
  '/oduller — Ödülleri listele',
  '/odulekle <i>metin</i> — Ödül ekle (ör. <code>/odulekle Sinema gecesi</code>)',
  '/odulsil <i>numara</i> — Ödülü sil',
  '',
  `<b>👑 Büyük Hediye</b> (her ${config.bigBoxThreshold} puanda)`,
  '/buyukoduller — Büyük ödülleri listele',
  '/buyukodulekle <i>metin</i> — Büyük ödül ekle (ör. <code>/buyukodulekle Lunaparka gitmek</code>)',
  '/buyukodulsil <i>numara</i> — Büyük ödülü sil',
  '',
  '/start — Uygulamayı aç · /yardim — Bu mesaj',
].join('\n');

/** Sürpriz Kutu ve Büyük Hediye ödül listeleri aynı komut kalıbını kullanır. */
const REWARD_COMMANDS: Record<RewardKind, {
  kind: RewardKind;
  list: string;
  add: string;
  remove: string;
  title: string;
  subtitle: string;
  short: string;
  example: string;
}> = {
  small: {
    kind: 'small',
    list: 'oduller',
    add: 'odulekle',
    remove: 'odulsil',
    title: '🎁 Sürpriz Kutu Ödülleri',
    subtitle: `Her ${config.boxThreshold} puanda bir kutu açılır.`,
    short: 'Ödül',
    example: 'Sinema gecesi',
  },
  big: {
    kind: 'big',
    list: 'buyukoduller',
    add: 'buyukodulekle',
    remove: 'buyukodulsil',
    title: '👑 Büyük Hediye Ödülleri',
    subtitle: `Her ${config.bigBoxThreshold} puanda bir Büyük Hediye Kutusu açılır.`,
    short: 'Büyük ödül',
    example: 'Lunaparka gitmek',
  },
};

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

/** "Ali" gibi kullanıcı girdisini temizler: fazla boşlukları atar, ilk harfi büyütür, 30 karakterle sınırlar. */
function cleanName(raw: string): string {
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, 30);
  return name.charAt(0).toLocaleUpperCase('tr-TR') + name.slice(1);
}

const childLine = (c: Child, i: number) => `${i + 1}. ${c.avatar} <b>${escapeHtml(c.name)}</b> — ⭐ ${c.total_points} puan`;

function childrenListText(children: Child[]): string {
  if (children.length === 0) return 'Henüz çocuk eklenmedi. Eklemek için: <code>/isim Ali</code>';
  return children.map(childLine).join('\n');
}

const GENDER_WORDS: Record<string, Gender> = { erkek: 'boy', oğlan: 'boy', oglan: 'boy', kız: 'girl', kiz: 'girl' };
const GENDER_LABEL: Record<Gender, string> = { boy: '👦 Erkek', girl: '👧 Kız' };

/** "/isim Ali erkek" → { name: "Ali", gender: "boy" }; cinsiyet kelimesi yoksa gender undefined. */
function parseNameAndGender(raw: string): { name: string; gender?: Gender } {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  // Tek kelime yazıldıysa o kelime isimdir ("/isim Kız" gibi nadir durumlar dahil).
  const gender = words.length > 1 ? GENDER_WORDS[words.at(-1)!.toLocaleLowerCase('tr-TR')] : undefined;
  if (gender) words.pop();
  return { name: cleanName(words.join(' ')), gender };
}

const genderKeyboard = (childId: number) =>
  new InlineKeyboard().text(GENDER_LABEL.boy, `gender:${childId}:boy`).text(GENDER_LABEL.girl, `gender:${childId}:girl`);

async function askGender(ctx: Context, child: Child): Promise<void> {
  await ctx.reply(`👉 Lütfen <b>${escapeHtml(child.name)}</b> için cinsiyet seçin:`, {
    parse_mode: 'HTML',
    reply_markup: genderKeyboard(child.id),
  });
}

/** Cinsiyeti seçilmemiş çocuklar için tek tek soru sorar. */
async function askMissingGenders(ctx: Context, children: Child[]): Promise<void> {
  for (const child of children.filter((c) => !c.gender)) await askGender(ctx, child);
}

/** Komuttaki sıra numarasına göre çocuğu bulur (1'den başlar). */
function childByNumber(family: Family, text: string): Child | undefined {
  const index = Number.parseInt(text, 10) - 1;
  return Number.isInteger(index) ? repo.listChildren(family.id)[index] : undefined;
}

export function registerBotHandlers(bot: Bot): void {
  // Bot yalnızca özel sohbetlerde çalışır (bir aile = bir ebeveyn sohbeti).
  const pm = bot.chatType('private');

  pm.command('start', async (ctx) => {
    const children = repo.listChildren(familyOf(ctx).id);
    await ctx.reply(
      [
        `Merhaba ${escapeHtml(ctx.from.first_name)}! 👋 <b>KaizenKids</b>'e hoş geldiniz.`,
        '',
        'Her gün %1 daha iyi! 🌱 Uygulamayı açınca çocuğunuz adını seçer; görevini tamamladığında ' +
          '"Yaptım!" der, ben de onaylamanız için size buraya mesaj atarım.',
        '',
        `⭐ Onaylanan görevler puan kazandırır, her ${config.boxThreshold} puanda bir 🎁 <b>Sürpriz Kutu</b> açılır.`,
        '',
        children.length
          ? `<b>Çocuklarınız</b>\n${childrenListText(children)}\n\nBaşka çocuk eklemek için: <code>/isim Ad</code>`
          : '👉 Önce çocuğunuzu ekleyin: <code>/isim Ali</code>\nBirden fazla çocuğunuz varsa her biri için ayrı yazın.',
        '',
        'Tüm komutlar için: /yardim',
      ].join('\n'),
      { parse_mode: 'HTML', reply_markup: openAppKeyboard() },
    );
    await askMissingGenders(ctx, children);
    if (hasValidWebAppUrl) {
      await setChatMenuButton(bot, ctx.chat.id);
    } else {
      await ctx.reply('⚠️ WEBAPP_URL ayarlı değil (HTTPS olmalı). Mini App butonu gösterilemiyor.');
    }
  });

  pm.command(['yardim', 'help'], (ctx) => ctx.reply(HELP_TEXT, { parse_mode: 'HTML' }));

  // ---------- Çocuklar ----------

  pm.command('isim', async (ctx) => {
    const family = familyOf(ctx);
    const { name, gender } = parseNameAndGender(ctx.match);
    if (!name) {
      await ctx.reply(
        `Çocuk eklemek için adını yazın. Örnek: <code>/isim Ali</code> ya da <code>/isim Ayşe kız</code>\n\n${childrenListText(repo.listChildren(family.id))}`,
        { parse_mode: 'HTML' },
      );
      return;
    }

    const result = repo.addChild(family.id, name, gender);
    if (!result.ok) {
      await ctx.reply(
        result.reason === 'DUPLICATE'
          ? `<b>${escapeHtml(name)}</b> zaten listede. Adı değiştirmek için: <code>/isimdegistir 1 YeniAd</code>`
          : `En fazla ${MAX_CHILDREN} çocuk eklenebilir. Önce /cocuksil ile birini kaldırın.`,
        { parse_mode: 'HTML' },
      );
      return;
    }

    const { child, restored } = result;
    await ctx.reply(
      [
        restored
          ? `${child.avatar} <b>${escapeHtml(child.name)}</b> geri eklendi; puanları ve serisi kaldığı yerden devam ediyor. 🎉`
          : `${child.avatar} <b>${escapeHtml(child.name)}</b> eklendi! 🎉`,
        '',
        `<b>Çocuklarınız</b>\n${childrenListText(repo.listChildren(family.id))}`,
        '',
        'Uygulamayı açınca "Bugün kim oynuyor?" ekranından adını seçebilir.',
      ].join('\n'),
      { parse_mode: 'HTML', reply_markup: child.gender ? openAppKeyboard() : undefined },
    );
    if (!child.gender) await askGender(ctx, child);
  });

  pm.command('cinsiyet', async (ctx) => {
    const family = familyOf(ctx);
    const child = childByNumber(family, ctx.match.trim());
    if (!child) {
      await ctx.reply(`Kullanım: <code>/cinsiyet 1</code>\n\n${childrenListText(repo.listChildren(family.id))}`, {
        parse_mode: 'HTML',
      });
      return;
    }
    await askGender(ctx, child);
  });

  // Cinsiyet butonları: gender:<çocukId>:<boy|girl>. Yalnızca çocuğun kendi ebeveyni seçebilir.
  bot.callbackQuery(/^gender:(\d+):(boy|girl)$/, async (ctx) => {
    const [, idText, gender] = ctx.match as RegExpMatchArray;
    const family = repo.getFamilyByTelegramId(ctx.from.id);
    const child = family && repo.setChildGender(family.id, Number(idText), gender as Gender);
    if (!child?.gender) {
      await ctx.answerCallbackQuery({ text: 'Bu çocuk bulunamadı.', show_alert: true });
      return;
    }
    await ctx.answerCallbackQuery({ text: `${child.name}: ${GENDER_LABEL[child.gender]}` });
    await ctx
      .editMessageText(
        `${child.avatar} <b>${escapeHtml(child.name)}</b> — ${child.gender === 'boy' ? 'Erkek' : 'Kız'} olarak kaydedildi. ✅`,
        { parse_mode: 'HTML', reply_markup: openAppKeyboard() },
      )
      .catch(() => undefined);
  });

  pm.command('cocuklar', async (ctx) => {
    const children = repo.listChildren(familyOf(ctx).id);
    await ctx.reply(
      `<b>Çocuklarınız</b>\n\n${childrenListText(children)}\n\nCinsiyeti değiştirmek için: <code>/cinsiyet 1</code>`,
      { parse_mode: 'HTML' },
    );
    await askMissingGenders(ctx, children);
  });

  pm.command('isimdegistir', async (ctx) => {
    const family = familyOf(ctx);
    const [numberText = '', ...rest] = ctx.match.trim().split(/\s+/);
    const child = childByNumber(family, numberText);
    const name = cleanName(rest.join(' '));
    if (!child || !name) {
      await ctx.reply(
        `Kullanım: <code>/isimdegistir 2 Elif</code>\n\n${childrenListText(repo.listChildren(family.id))}`,
        { parse_mode: 'HTML' },
      );
      return;
    }
    if (repo.renameChild(family.id, child.id, name) === 'DUPLICATE') {
      await ctx.reply(`<b>${escapeHtml(name)}</b> adında başka bir çocuk zaten var.`, { parse_mode: 'HTML' });
      return;
    }
    await ctx.reply(`✏️ ${escapeHtml(child.name)} → <b>${escapeHtml(name)}</b> olarak değiştirildi.`, {
      parse_mode: 'HTML',
    });
  });

  pm.command('cocuksil', async (ctx) => {
    const family = familyOf(ctx);
    const child = childByNumber(family, ctx.match.trim());
    if (!child) {
      await ctx.reply(`Kullanım: <code>/cocuksil 2</code>\n\n${childrenListText(repo.listChildren(family.id))}`, {
        parse_mode: 'HTML',
      });
      return;
    }
    repo.deactivateChild(family.id, child.id);
    await ctx.reply(
      `🗑️ <b>${escapeHtml(child.name)}</b> listeden kaldırıldı.\n` +
        `Verileri saklanıyor; geri eklemek için: <code>/isim ${escapeHtml(child.name)}</code>`,
      { parse_mode: 'HTML' },
    );
  });

  // ---------- Takip ----------

  pm.command('durum', async (ctx) => {
    const family = familyOf(ctx);
    const children = repo.listChildren(family.id);
    const today = todayKey();
    const tasks = repo.listTasksForDate(today);

    if (children.length === 0) {
      await ctx.reply(childrenListText(children), { parse_mode: 'HTML' });
      return;
    }

    // /durum 2 → tek çocuğun ayrıntılı görev listesi
    const selected = ctx.match.trim() ? childByNumber(family, ctx.match.trim()) : undefined;
    if (selected) {
      const statusByTask = new Map(repo.getLogsForDate(selected.id, today).map((l) => [l.task_id, l.status]));
      const points = repo.getPointsSummary(selected);
      await ctx.reply(
        [
          `${selected.avatar} <b>${escapeHtml(selected.name)}</b> — Bugün (${today})`,
          '',
          ...tasks.map(
            (t) => `${STATUS_ICON[statusByTask.get(t.id) ?? 'todo']} ${t.emoji} ${escapeHtml(t.title)} (+${t.points})`,
          ),
          '',
          `⭐ Bugün: <b>${repo.getPointsForDate(selected.id, today)}</b> puan · Toplam: <b>${points.total}</b>`,
          points.availableBoxes > 0
            ? `🎁 Açılmayı bekleyen kutu: <b>${points.availableBoxes}</b>`
            : `🎁 Sürpriz Kutuya ${points.threshold - points.inCycle} puan kaldı`,
          points.big.availableBoxes > 0
            ? `👑 Açılmayı bekleyen Büyük Hediye: <b>${points.big.availableBoxes}</b>`
            : `👑 Büyük Hediyeye ${points.big.threshold - points.big.inCycle} puan kaldı`,
          `🔥 Seri: ${repo.getStreak(selected.id, today)} gün`,
          '',
          '⬜️ yapılmadı · ⏳ onay bekliyor · ✅ onaylandı · 🔁 reddedildi',
        ].join('\n'),
        { parse_mode: 'HTML' },
      );
      return;
    }

    // /durum → tüm çocukların kısa özeti
    const blocks = children.map((child, i) => {
      const logs = repo.getLogsForDate(child.id, today);
      const done = logs.filter((l) => l.status === 'approved').length;
      const pending = logs
        .filter((l) => l.status === 'pending')
        .map((l) => tasks.find((t) => t.id === l.task_id)?.title)
        .filter(Boolean);
      const points = repo.getPointsSummary(child);
      return [
        `${i + 1}. ${child.avatar} <b>${escapeHtml(child.name)}</b>`,
        `   ✅ ${done}/${tasks.length} görev · bugün +${repo.getPointsForDate(child.id, today)} · ` +
          `⭐ ${points.total} puan · 🔥 ${repo.getStreak(child.id, today)} gün`,
        `   👑 Büyük Hediyeye ${points.big.threshold - points.big.inCycle} puan` +
          (points.availableBoxes > 0 ? ` · 🎁 ${points.availableBoxes} kutu` : '') +
          (points.big.availableBoxes > 0 ? ` · 👑 ${points.big.availableBoxes} büyük kutu` : ''),
        ...(pending.length ? [`   ⏳ Onay bekleyen: ${pending.map((p) => escapeHtml(p!)).join(', ')}`] : []),
      ].join('\n');
    });
    await ctx.reply(
      [`<b>Bugünün Durumu</b> (${today})`, '', ...blocks, '', 'Ayrıntı için: <code>/durum 1</code>'].join('\n'),
      { parse_mode: 'HTML' },
    );
  });

  // ---------- Ödüller ----------

  for (const meta of Object.values(REWARD_COMMANDS)) {
    pm.command(meta.list, async (ctx) => {
      const rewards = repo.listActiveRewards(familyOf(ctx).id, meta.kind);
      if (rewards.length === 0) {
        await ctx.reply(`Henüz ödül yok. Eklemek için: /${meta.add} ${meta.example}`);
        return;
      }
      const list = rewards.map((r, i) => `${i + 1}. ${escapeHtml(r.title)}`).join('\n');
      await ctx.reply(`<b>${meta.title}</b>\n<i>${meta.subtitle}</i>\n\n${list}\n\nSilmek için: /${meta.remove} 2`, {
        parse_mode: 'HTML',
      });
    });

    pm.command(meta.add, async (ctx) => {
      const title = ctx.match.trim().slice(0, 80);
      if (!title) {
        await ctx.reply(`Lütfen ödülü yazın. Örnek: /${meta.add} ${meta.example}`);
        return;
      }
      repo.addReward(familyOf(ctx).id, title, meta.kind);
      await ctx.reply(`✅ ${meta.short} eklendi: <b>${escapeHtml(title)}</b>`, { parse_mode: 'HTML' });
    });

    pm.command(meta.remove, async (ctx) => {
      const family = familyOf(ctx);
      const index = Number(ctx.match.trim()) - 1;
      const reward = repo.listActiveRewards(family.id, meta.kind)[index];
      if (!reward) {
        await ctx.reply(`Geçersiz numara. Önce /${meta.list} ile listeye bakın.`);
        return;
      }
      repo.deactivateReward(family.id, reward.id);
      await ctx.reply(`🗑️ ${meta.short} silindi: <b>${escapeHtml(reward.title)}</b>`, { parse_mode: 'HTML' });
    });
  }

  registerApprovalHandlers(bot);

  bot.catch((err) => console.error('Bot hatası:', err.error));
}

/** Komut menüsünü ve sohbetteki "menü butonu"nu (Mini App kısayolu) ayarlar. */
export async function configureBotProfile(bot: Bot): Promise<void> {
  await bot.api.setMyCommands([
    { command: 'start', description: 'Uygulamayı aç' },
    { command: 'durum', description: 'Bugünkü görevler ve puanlar' },
    { command: 'isim', description: 'Çocuk ekle' },
    { command: 'cocuklar', description: 'Çocukları listele' },
    { command: 'isimdegistir', description: 'Çocuğun adını değiştir' },
    { command: 'cinsiyet', description: 'Çocuğun cinsiyetini seç' },
    { command: 'cocuksil', description: 'Çocuğu listeden kaldır' },
    { command: 'oduller', description: 'Sürpriz Kutu ödülleri' },
    { command: 'odulekle', description: 'Yeni ödül ekle' },
    { command: 'odulsil', description: 'Ödül sil' },
    { command: 'buyukoduller', description: 'Büyük Hediye ödülleri' },
    { command: 'buyukodulekle', description: 'Büyük ödül ekle' },
    { command: 'buyukodulsil', description: 'Büyük ödül sil' },
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
