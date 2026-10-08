import { config, hasValidWebAppUrl } from './config.js';
import './db/index.js'; // şema + sabit görevler
import { createApp } from './api/app.js';
import { bot } from './bot/bot.js';
import { configureBotProfile, registerBotHandlers } from './bot/handlers.js';

registerBotHandlers(bot);

const server = createApp().listen(config.port, () => {
  console.log(`🌐 API http://localhost:${config.port} adresinde çalışıyor`);
});

if (!hasValidWebAppUrl) {
  console.warn('⚠️  WEBAPP_URL HTTPS değil; Telegram içinde Mini App butonu gösterilmeyecek.');
}
if (config.devAuthBypass) {
  console.warn(`⚠️  DEV_AUTH_BYPASS açık: Telegram dışı istekler ${config.devUserId} kullanıcısı sayılacak.`);
}

await configureBotProfile(bot).catch((error) => console.warn('Bot profili ayarlanamadı:', error));

// Long polling: MVP için webhook kurulumuna gerek yok.
bot
  .start({
    drop_pending_updates: true,
    onStart: (me) => console.log(`🤖 @${me.username} çalışıyor`),
  })
  .catch((error) => {
    console.error('❌ Bot başlatılamadı (BOT_TOKEN doğru mu?):', error.message ?? error);
    process.exit(1);
  });

const shutdown = async () => {
  await bot.stop();
  server.close();
  process.exit(0);
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
