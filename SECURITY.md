# Güvenlik Politikası

## Açık bildirimi

Bir güvenlik açığı bulduysanız lütfen **herkese açık bir issue açmayın**. Depo sahibine GitHub üzerinden özel olarak ulaşın (depo sayfasında **Security → Report a vulnerability**, açıksa) ve şunları paylaşın:

- Açığın kısa tanımı ve etkisi
- Yeniden üretme adımları
- Varsa önerilen çözüm

Bildirimler en kısa sürede incelenir; düzeltme yayımlanana kadar ayrıntılar gizli tutulur.

## Kendi kurulumunuz için

- `BOT_TOKEN` değerini yalnızca `.env` dosyasında tutun; bu dosyayı asla paylaşmayın ya da commit etmeyin.
- Token'ın sızdığından şüpheleniyorsanız Telegram'da @BotFather → `/revoke` ile hemen iptal edin ve yenisini `.env`'e yazın.
- `DEV_AUTH_BYPASS=true` yalnızca yerel geliştirme içindir; sürekli çalışan kurulumlarda `false` bırakın.
- `data/` klasörü çocuk adları ve görev geçmişi içerir; yedeklerini güvenli bir yerde saklayın.
