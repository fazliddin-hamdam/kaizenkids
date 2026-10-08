import { InlineKeyboard, type Bot, type Context } from 'grammy';
import { config } from '../config.js';
import * as repo from '../db/repo.js';
import { MAX_REWARDS, REWARD_EXAMPLES, TARGET_REWARDS } from '../db/schema.js';
import type { Family, RewardKind } from '../types.js';
import { escapeHtml } from './bot.js';

/**
 * Hediye listeleri: ebeveyn hediyeleri kendisi yazar.
 *  /hediyeler            → iki listenin özeti, nasıl yazılacağı, örnekler ve "ekle" butonları
 *  [➕ ekle] butonu       → bot "hediyeyi yazın" der; ebeveyn o mesajı yanıtlayarak yazar (5'e kadar tekrar sorar)
 *  /odulekle metin       → doğrudan ekleme; her satır ayrı bir hediye olabilir
 */

export const REWARD_META: Record<
  RewardKind,
  { emoji: string; name: string; when: string; hint: string; list: string; add: string; remove: string; prompt: string }
> = {
  small: {
    emoji: '🎁',
    name: 'Sürpriz Kutu',
    when: `her ${config.boxThreshold} puanda`,
    hint: 'Küçük, aynı gün verilebilecek hediyeler.',
    list: 'oduller',
    add: 'odulekle',
    remove: 'odulsil',
    prompt: '🎁 Sürpriz Kutu hediyesi yazın',
  },
  big: {
    emoji: '👑',
    name: 'Büyük Hediye',
    when: `her ${config.bigBoxThreshold} puanda`,
    hint: 'Özel, önceden planlanan hediyeler.',
    list: 'buyukoduller',
    add: 'buyukodulekle',
    remove: 'buyukodulsil',
    prompt: '👑 Büyük hediye yazın',
  },
};

const KINDS: RewardKind[] = ['small', 'big'];

const counter = (n: number) => (n >= TARGET_REWARDS ? `✅ ${n}/${TARGET_REWARDS}` : `✏️ ${n}/${TARGET_REWARDS}`);

const addButtons = () =>
  new InlineKeyboard()
    .text(`${REWARD_META.small.emoji} Sürpriz Kutu hediyesi ekle`, 'reward_add:small')
    .row()
    .text(`${REWARD_META.big.emoji} Büyük hediye ekle`, 'reward_add:big');

/** Bir listenin numaralı hâli (silme komutları bu numaraları kullanır). */
function listBlock(familyId: number, kind: RewardKind): string {
  const meta = REWARD_META[kind];
  const rewards = repo.listActiveRewards(familyId, kind);
  const items = rewards.length
    ? rewards.map((r, i) => `${i + 1}. ${escapeHtml(r.title)}`).join('\n')
    : '<i>(henüz hediye yazılmadı)</i>';
  return `<b>${meta.emoji} ${meta.name}</b> — ${meta.when} · ${counter(rewards.length)}\n<i>${meta.hint}</i>\n${items}`;
}

/** Listeler eksikse kısa bir hatırlatma; ikisi de tamamsa null. */
export function rewardsNudge(familyId: number): string | null {
  const counts = KINDS.map((k) => repo.listActiveRewards(familyId, k).length);
  if (counts.every((n) => n >= TARGET_REWARDS)) return null;
  return (
    `📝 <b>Hediye listeniz eksik</b> — ${REWARD_META.small.emoji} ${counts[0]}/${TARGET_REWARDS} · ` +
    `${REWARD_META.big.emoji} ${counts[1]}/${TARGET_REWARDS}\n` +
    'Kutular açıldığında çıkacak hediyeleri siz yazarsınız. Başlamak için: /hediyeler'
  );
}

/** /hediyeler: özet + nasıl yazılır + örnekler. */
function overviewText(familyId: number): string {
  return [
    '<b>🎁 Hediye Listeleri</b>',
    '',
    'Hediyeleri <b>siz yazarsınız</b>; çocuğunuz kutuyu açınca listeden biri rastgele çıkar. ' +
      `Her liste için en az <b>${TARGET_REWARDS} farklı</b> hediye yazmanızı öneririz (en fazla ${MAX_REWARDS}).`,
    '',
    listBlock(familyId, 'small'),
    '',
    listBlock(familyId, 'big'),
    '',
    '<b>✍️ Nasıl yazılır?</b>',
    '• Aşağıdaki butona basın, gelen mesajı <b>yanıtlayarak</b> hediyeyi yazın.',
    `• Ya da komutla: <code>/odulekle ${REWARD_EXAMPLES.small[0]}</code> · <code>/buyukodulekle ${REWARD_EXAMPLES.big[0]}</code>`,
    '• Tek seferde birden fazla yazmak için her satıra bir hediye yazın.',
    '• Silmek için: <code>/odulsil 2</code> · <code>/buyukodulsil 1</code>',
    '',
    '<b>💡 Örnek fikirler</b>',
    `${REWARD_META.small.emoji} ${REWARD_EXAMPLES.small.join(' · ')}`,
    `${REWARD_META.big.emoji} ${REWARD_EXAMPLES.big.join(' · ')}`,
    '',
    '<i>İpucu: Net ve tutabileceğiniz sözler yazın; hediyeleri çocuğunuzla birlikte seçmek motivasyonu artırır.</i>',
  ].join('\n');
}

/** "Hediyeyi yazın" sorusu: ebeveyn bu mesajı yanıtlayınca yazdığı hediye kaydedilir. */
async function askForReward(ctx: Context, kind: RewardKind): Promise<void> {
  const meta = REWARD_META[kind];
  const n = repo.listActiveRewards(familyOf(ctx).id, kind).length;
  await ctx.reply(
    `${meta.prompt} (${n}/${TARGET_REWARDS}):\n` +
      'Bu mesajı yanıtlayarak yazın. Birden fazla yazacaksanız her satıra bir hediye.',
    {
      reply_markup: {
        force_reply: true,
        input_field_placeholder: `Örn: ${REWARD_EXAMPLES[kind][n % REWARD_EXAMPLES[kind].length]}`,
      },
    },
  );
}

function familyOf(ctx: Context): Family {
  return repo.getOrCreateFamily(ctx.from!.id, ctx.from!.first_name);
}

/** Yazılan metni hediyelere çevirir (her satır bir hediye), kaydeder ve sonucu bildirir. */
async function saveRewards(ctx: Context, kind: RewardKind, text: string): Promise<void> {
  const meta = REWARD_META[kind];
  const family = familyOf(ctx);
  const titles = text
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim().slice(0, 80)) // "1. ", "- " gibi başlıkları at
    .filter(Boolean);
  if (titles.length === 0) {
    await askForReward(ctx, kind);
    return;
  }

  const result = repo.addRewards(family.id, titles, kind);
  const lines = [
    result.added.length ? `✅ Eklendi: <b>${result.added.map(escapeHtml).join('</b>, <b>')}</b>` : '',
    result.duplicates.length ? `↩️ Zaten listede: ${result.duplicates.map(escapeHtml).join(', ')}` : '',
    result.overLimit.length ? `⚠️ Liste dolu (en fazla ${MAX_REWARDS}); eklenmedi: ${result.overLimit.map(escapeHtml).join(', ')}` : '',
    `${meta.emoji} ${meta.name}: ${counter(result.total)}`,
  ].filter(Boolean);

  if (result.total < TARGET_REWARDS) {
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
    await askForReward(ctx, kind); // hedefe ulaşana kadar bir sonrakini iste
    return;
  }

  lines.push('', `🎉 Harika! ${meta.name} için ${result.total} hediye hazır.`);
  const other: RewardKind = kind === 'small' ? 'big' : 'small';
  const otherCount = repo.listActiveRewards(family.id, other).length;
  if (otherCount < TARGET_REWARDS) {
    lines.push(`Sıradaki: ${REWARD_META[other].emoji} ${REWARD_META[other].name} (${otherCount}/${TARGET_REWARDS})`);
  }
  await ctx.reply(lines.join('\n'), {
    parse_mode: 'HTML',
    reply_markup: otherCount < TARGET_REWARDS ? addButtons() : undefined,
  });
}

export function registerRewardHandlers(bot: Bot): void {
  const pm = bot.chatType('private');

  pm.command('hediyeler', (ctx) =>
    ctx.reply(overviewText(familyOf(ctx).id), { parse_mode: 'HTML', reply_markup: addButtons() }),
  );

  for (const kind of KINDS) {
    const meta = REWARD_META[kind];

    pm.command(meta.list, (ctx) =>
      ctx.reply(`${listBlock(familyOf(ctx).id, kind)}\n\nEklemek için: /${meta.add} · Silmek için: /${meta.remove} 2`, {
        parse_mode: 'HTML',
      }),
    );

    // "/odulekle" tek başına yazılırsa adım adım sorar; metinle yazılırsa doğrudan ekler.
    pm.command(meta.add, (ctx) => (ctx.match.trim() ? saveRewards(ctx, kind, ctx.match) : askForReward(ctx, kind)));

    pm.command(meta.remove, async (ctx) => {
      const family = familyOf(ctx);
      const reward = repo.listActiveRewards(family.id, kind)[Number(ctx.match.trim()) - 1];
      if (!reward) {
        await ctx.reply(`Geçersiz numara. Önce /${meta.list} ile listeye bakın.`);
        return;
      }
      repo.deactivateReward(family.id, reward.id);
      const left = repo.listActiveRewards(family.id, kind).length;
      await ctx.reply(`🗑️ Silindi: <b>${escapeHtml(reward.title)}</b>\n${meta.emoji} ${meta.name}: ${counter(left)}`, {
        parse_mode: 'HTML',
      });
    });
  }

  bot.callbackQuery(/^reward_add:(small|big)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await askForReward(ctx, ctx.match[1] as RewardKind);
  });

  // "Hediyeyi yazın" sorusuna verilen yanıtlar.
  pm.on('message:text', async (ctx, next) => {
    const question = ctx.message.reply_to_message;
    const kind = KINDS.find((k) => question?.text?.startsWith(REWARD_META[k].prompt));
    if (!kind || question?.from?.id !== ctx.me.id || ctx.message.text.startsWith('/')) return next();
    await saveRewards(ctx, kind, ctx.message.text);
  });
}
