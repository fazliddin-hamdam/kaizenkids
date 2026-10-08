# Role and Goal
You are an Expert Full-Stack Developer specializing in Telegram Mini Apps (TMA), Node.js (TypeScript), React.js (Vite), and UI/UX Gamification. 

I want to build an MVP for a Telegram Mini App called **"KaizenKids"**. 
Based on the "Atomic Habits" philosophy, it helps children (ages 7-9) build daily habits through a gamified interface, while parents track and approve their progress via Telegram bot messages.

## Tech Stack (Modern & Lightweight)
- **Frontend (Mini App):** React.js (Vite), TypeScript, Tailwind CSS, Telegram Web Apps SDK (`@twa-dev/sdk`).
- **Backend (Bot & API):** Node.js, TypeScript, `grammY` or `Telegraf` framework, Express (for Mini App API routes if needed).
- **Database:** SQLite (using `better-sqlite3` or `Prisma` ORM for rapid MVP development).

## Core Application Flow & Mechanics
The application has a split experience: **Child (Mini App)** and **Parent (Telegram Chat)**.

### 1. Child Experience (Frontend / TMA)
- The child opens the Mini App from the parent's phone.
- They see a colorful, easy-to-use, gamified dashboard (Turkish UI).
- They see pre-defined daily tasks categorized by time (Morning, Afternoon, Evening).
- When the child completes a task, they click the "Yaptım!" (Done) button.
- **Crucial:** The task does NOT instantly give points. It changes to a "Waiting for Parent Approval" state.

### 2. Parent Experience (Backend / Bot)
- When the child clicks "Yaptım!", the bot instantly sends an inline keyboard message to the Parent's Telegram chat.
- Message: *"Çocuğunuz 'Diş Fırçalama' görevini tamamladığını söylüyor. Onaylıyor musunuz?"*
- Buttons: `[✅ Onayla]` (Approve) / `[❌ Hayır, Yapmadı]` (Reject).
- If the parent approves, the child's Mini App updates, points are added, and a small celebration animation plays on the frontend.

### 3. Rewards & Gamification
- The child has a point progress bar.
- Reaching a certain milestone (e.g., 50 points) unlocks a "Sürpriz Kutu" (Surprise Box).
- The surprise box contains a real-world reward pre-defined by the parent (e.g., "Parkta yarım saat ekstra oyun", "Sinema gecesi").

## MVP Pre-defined Tasks (Fixed for v1)
Since this is an MVP, parents will NOT create tasks. Use these hardcoded tasks in the database:
- **Sabah (Morning):** Yatağını Topla, Dişlerini Fırçala, Kahvaltını Bitir.
- **Öğle/Okul Sonrası (Afternoon):** Okul Çantanı Düzenle, 15 Dakika Kitap Oku.
- **Akşam (Evening):** Oyuncaklarını Topla, Erken Uyu (21:30).

## Your Tasks
Please provide a complete architecture and code generation for this MVP. Break down your response into the following logical steps:

1.  **Folder Structure:** Provide a standard monorepo folder structure for both the bot (backend) and the Mini App (frontend).
2.  **Database Schema (SQLite):** Write the schema (or Prisma schema) for `Users/Families`, `Tasks`, `DailyLogs` (to track completed tasks and approval status), and `Rewards`.
3.  **Backend Logic (Node.js + Bot):** 
    - Provide the setup for the Telegram bot.
    - Write the specific function that handles the child's "Done" action, sends the approval message to the parent, and processes the parent's inline button callback (`✅ Onayla`).
4.  **Frontend Logic (React):**
    - Provide the main Dashboard component code using Tailwind CSS.
    - Make sure the UI is very colorful, kid-friendly, and uses large buttons.
    - Show how it communicates with the Telegram Web App SDK to get user data.

Please write clean, modular, and well-commented code. Ask me any clarifying questions before writing the code if you need to, or proceed directly with the implementation plan if you are ready. All user-facing text (UI and Bot messages) MUST be in Turkish.