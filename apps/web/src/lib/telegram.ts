import WebApp from '@twa-dev/sdk';

/**
 * Telegram Web App SDK ile ilgili tüm işlemler burada toplanır.
 * Uygulama normal tarayıcıda açılırsa (geliştirme) SDK sessizce devre dışı kalır.
 */

/** initData boş değilse uygulama gerçekten Telegram içinde çalışıyordur. */
export const isInTelegram = (): boolean => Boolean(WebApp.initData);

/** Backend'e imzalı olarak gönderilen ham initData (sunucu HMAC ile doğrular). */
export const getInitData = (): string => WebApp.initData;

/** İmzasız kullanıcı bilgisi — yalnızca arayüzde göstermek için; güvenlik için sunucu doğrulaması esastır. */
export const getTelegramUser = () => WebApp.initDataUnsafe?.user;

const supports = (version: string) => isInTelegram() && WebApp.isVersionAtLeast(version);

/** Uygulama açılışında bir kez çağrılır. */
export function initTelegram(): void {
  if (!isInTelegram()) return;
  WebApp.ready(); // Telegram'a "yüklendim" de (yükleniyor ekranını kapatır)
  WebApp.expand(); // tam yükseklikte aç
  if (supports('6.1')) {
    WebApp.setHeaderColor('#7dd3fc');
    WebApp.setBackgroundColor('#e0f2fe');
  }
  // Çocuk aşağı kaydırırken uygulama yanlışlıkla kapanmasın.
  if (supports('7.7')) WebApp.disableVerticalSwipes();
}

/** Dokunsal geri bildirim (titreşim) — çocuklar için butonlara "his" katar. */
export const haptic = {
  tap: () => supports('6.1') && WebApp.HapticFeedback.impactOccurred('medium'),
  success: () => supports('6.1') && WebApp.HapticFeedback.notificationOccurred('success'),
  warning: () => supports('6.1') && WebApp.HapticFeedback.notificationOccurred('warning'),
  error: () => supports('6.1') && WebApp.HapticFeedback.notificationOccurred('error'),
};
