# 🌱 KaizenKids — MVP

Atomik Alışkanlıklar felsefesiyle 7-9 yaş çocuklar için Telegram Mini App.
Çocuk görevini yapınca **"Yaptım!"** der → ebeveyne Telegram'dan onay mesajı gider → ebeveyn **✅ Onayla** derse puan eklenir, çocuğun ekranında kutlama oynar → her 100 puanda bir **🎁 Sürpriz Kutu** açılır.

## Klasör Yapısı

```
AtomBot/
├─ package.json            # npm workspaces (apps/*), ortak scriptler
├─ .env.example            # ortam değişkenleri şablonu
└─ apps/
   ├─ server/              # Node.js + TypeScript: grammY bot + Express API + SQLite
   │  └─ src/
   │     ├─ index.ts             # giriş: API'yi ve botu (long polling) başlatır
   │     ├─ config.ts            # .env okuma
   │     ├─ types.ts             # DB satırları + API tipleri
   │     ├─ db/
   │     │  ├─ schema.ts         # SQLite şeması, sabit görevler, örnek ödüller
   │     │  ├─ index.ts          # bağlantı + migration + seed
   │     │  └─ repo.ts           # tüm sorgular (transaction'lı onay, kutu açma, seri)
   │     ├─ bot/
   │     │  ├─ bot.ts            # Bot örneği
   │     │  └─ handlers.ts       # /start /isim /durum /oduller /odulekle /odulsil
   │     ├─ services/
   │     │  └─ approval.ts       # ⭐ "Yaptım!" → onay mesajı → ✅/❌ callback akışı
   │     ├─ api/
   │     │  ├─ auth.ts           # Telegram initData HMAC doğrulaması
   │     │  ├─ routes.ts         # GET /api/state, POST /api/tasks/:id/done, POST /api/box/open
   │     │  └─ app.ts            # Express uygulaması (+ üretimde web/dist servis eder)
   │     └─ utils/date.ts        # saat dilimine göre gün / gün bölümü
   └─ web/                 # React + Vite + Tailwind v4 + @twa-dev/sdk
      └─ src/
         ├─ lib/telegram.ts      # SDK: ready/expand, initData, titreşim
         ├─ lib/api.ts           # `Authorization: tma <initData>` ile istekler
         ├─ hooks/useDashboard.ts# yoklama + onay/ret geçişlerini yakalama
         └─ components/          # Dashboard, TaskCard, ProgressCard, PeriodTabs,
                                 # Celebration, SurpriseBoxModal, Toast
```

## Veritabanı

| Tablo | Amaç |
|---|---|
| `families` | Ebeveyn (Telegram ID) = aile |
| `children` | Ailenin çocukları; ad, avatar, toplam puan, açılan kutu sayısı |
| `tasks` | 13 sabit görev (sabah / okulda / okul sonrası / akşam); tam okul günü = 100 puan, hafta sonu okul görevleri gizlenir |
| `daily_logs` | aile + görev + gün başına tek kayıt: `pending` / `approved` / `rejected` |
| `rewards` | Ebeveynin ödülleri (Sürpriz Kutu içeriği) |
| `reward_claims` | Açılan kutuların geçmişi |

Puanlar yalnızca ebeveyn onayında, tek bir transaction içinde eklenir; aynı butona iki kez basmak çift puan vermez.

## Kurulum

1. **Bot oluşturun:** Telegram'da [@BotFather](https://t.me/BotFather) → `/newbot` → token'ı alın.
2. **Ortam dosyası:** `.env.example`'ı `.env` olarak kopyalayıp `BOT_TOKEN` değerini yazın.
3. **Bağımlılıklar:**
   ```bash
   npm install
   ```
4. **HTTPS tüneli** (Telegram Mini App yalnızca HTTPS açar). Örneğin:
   ```bash
   cloudflared tunnel --url http://localhost:5173
   ```
   Çıkan `https://...trycloudflare.com` adresini `.env` içinde `WEBAPP_URL` olarak yazın.
5. **Geliştirme modunda çalıştırın** (bot + API + Vite birlikte):
   ```bash
   npm run dev
   ```
6. Telegram'da botunuza `/start` yazın, `/isim Ali` ile çocuğun adını ayarlayın ve **🚀 KaizenKids'i Aç** butonuna basın.

### Telegram dışında (tarayıcıda) denemek

`.env` içinde `DEV_AUTH_BYPASS=true` ve `DEV_USER_ID=<kendi Telegram ID'niz>` yapın, `http://localhost:5173` adresini açın.
Onay mesajları bu ID'ye gider (önce bota `/start` yazmış olmalısınız).

### Kendi bilgisayarında sürekli çalıştırma (ücretsiz)

Proje köküne `cloudflared.exe` koyduktan sonra:

| Komut | Ne yapar |
|---|---|
| `npm run local:install` | Windows oturumu açılınca otomatik başlatır + şimdi arka planda başlatır |
| `npm run local:status` | Çalışıyor mu, güncel adres ne? |
| `npm run local:stop` | Durdurur (geliştirme için `npm run dev` öncesi gerekli) |
| `npm run local:start` | Ön planda başlatır (kapatınca durur) |
| `npm run local:uninstall` | Otomatik başlatmayı kaldırır ve durdurur |

Betik ([scripts/local-server.mjs](scripts/local-server.mjs)) uygulamayı derler, ücretsiz tüneli açar, yeni adresi
bota bildirir (menü butonu her ebeveyn sohbetinde güncellenir) ve çökme olursa her şeyi yeniden başlatır.
Kayıtlar: `logs/kaizenkids.log`. Bilgisayar uykuya geçerse bot da durur.

### Üretim

```bash
npm run build
npm start
```

Express, derlenmiş Mini App'i (`apps/web/dist`) aynı porttan sunar; `WEBAPP_URL`'i sunucunuzun HTTPS adresi yapın.

## Bot Komutları

| Komut | Açıklama |
|---|---|
| `/start` | Karşılama + Mini App butonu |
| `/isim Ali` | Çocuk ekler (her çocuk için ayrı yazılır; puan/seri/kutu çocuk başına ayrı) |
| `/cocuklar` | Çocukları listeler |
| `/isimdegistir 2 Elif` | 2. çocuğun adını değiştirir |
| `/cocuksil 2` | 2. çocuğu listeden kaldırır (veriler saklanır; aynı adla `/isim` yazılınca geri gelir) |
| `/durum` · `/durum 1` | Tüm çocukların özeti · 1. çocuğun görev listesi |
| `/oduller` | Sürpriz Kutu ödüllerini listeler |
| `/odulekle Sinema gecesi` | Ödül ekler |
| `/odulsil 2` | Listedeki 2. ödülü siler |
