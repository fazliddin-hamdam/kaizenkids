# 🌱 KaizenKids — MVP

Atomik Alışkanlıklar felsefesiyle 7-9 yaş çocuklar için Telegram Mini App.
Çocuk görevini yapınca **"Yaptım!"** der → ebeveyne Telegram'dan onay mesajı gider → ebeveyn **✅ Onayla** derse puan eklenir, çocuğun ekranında kutlama oynar → her 50 puanda bir **🎁 Sürpriz Kutu** açılır.

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
| `families` | Ebeveyn (Telegram ID) = aile; çocuk adı, toplam puan, açılan kutu sayısı |
| `tasks` | 7 sabit görev (sabah / okul sonrası / akşam), puanlarıyla |
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
| `/isim Ali` | Çocuğun adını ayarlar |
| `/durum` | Bugünkü görevler, puan, seri |
| `/oduller` | Sürpriz Kutu ödüllerini listeler |
| `/odulekle Sinema gecesi` | Ödül ekler |
| `/odulsil 2` | Listedeki 2. ödülü siler |
