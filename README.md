# MESOL Portal — Setup Guide

## What's in this project

```
mesol-portal/
├── index.js                  ← Express server (start here)
├── package.json
├── .env.example              ← Copy to .env and fill in values
├── supabase-setup.sql        ← Paste into Supabase SQL editor
├── lib/
│   └── supabase.js           ← Supabase client
├── middleware/
│   └── auth.js               ← JWT + Make secret protection
├── routes/
│   ├── auth.js               ← POST /api/auth/login + /teacher
│   ├── student.js            ← GET /api/student/me + /progress
│   ├── results.js            ← POST /api/results + daily-summary
│   ├── students.js           ← POST /api/students/create (Make.com)
│   └── teacher.js            ← GET /api/teacher/cohort + student/:id
└── public/
    ├── login.html            ← ✅ BUILT — student login page
    ├── sw.js                 ← ✅ BUILT — service worker (offline)
    ├── home.html             ← Week 2 (not yet built)
    ├── exercise.html         ← Week 3 (not yet built)
    ├── practice.html         ← Week 4 (not yet built)
    ├── progress.html         ← Week 5 (not yet built)
    └── content/
        ├── EL1/              ← Drop JSON exercise files here
        ├── EL2/
        └── EL3/
```

---

## PRE-02: Supabase Setup (~20 min)

1. Go to [supabase.com](https://supabase.com) → New Project
2. Name it `yeschool-mesol` — free tier is fine
3. Open **SQL Editor** → paste entire contents of `supabase-setup.sql` → Run
4. Go to **Settings → API** → copy:
   - Project URL → `SUPABASE_URL`
   - anon/public key → `SUPABASE_ANON_KEY`

---

## PRE-03: Local setup and Railway deploy (~25 min)

### Local
```bash
git clone <your-repo-url>
cd mesol-portal
npm install
cp .env.example .env
# Fill in .env with your Supabase values
node index.js
# Visit http://localhost:3000
```

### Generate JWT_SECRET
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Railway environment variables
Add all these in Railway → Project → Variables:
```
SUPABASE_URL
SUPABASE_ANON_KEY
JWT_SECRET
TEACHER_PASSWORD
MAKE_SECRET
PORT=3000
```

### Deploy
Push to GitHub → Railway auto-deploys on every push.

---

## Testing login (W1-S2)

1. In Supabase SQL Editor, insert a test student (uncomment the INSERT at bottom of `supabase-setup.sql`, use your real phone number)
2. Visit `https://mesol.yeschool.uk`
3. Enter your phone number (without +44 prefix) and PIN `1234`
4. Should redirect to `/home` (placeholder page until Week 2)

---

## API reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | None | Student login → JWT |
| POST | `/api/auth/teacher` | None | Teacher login → JWT |
| GET | `/api/student/me` | Student JWT | Profile + stats |
| GET | `/api/student/progress` | Student JWT | Full history |
| POST | `/api/results` | Student JWT | Save exercise result |
| GET | `/api/results/daily-summary` | Make secret | For Sheets sync |
| POST | `/api/students/create` | Make secret | Create student account |
| GET | `/api/teacher/cohort` | Teacher JWT | All students dashboard |
| GET | `/api/teacher/student/:id` | Teacher JWT | Single student detail |
| GET | `/health` | None | Railway health check |

---

## Current build status

| Session | Status | Notes |
|---------|--------|-------|
| PRE-01 | ⏳ In progress | Subdomain + Railway setup |
| PRE-02 | 🔲 Ready to do | Run supabase-setup.sql |
| PRE-03 | 🔲 Ready to do | npm install → push → deploy |
| W1-S1 | ✅ Built | login.html + sw.js done |
| W1-S2 | 🔲 Next | Test login with real student row |
| W2+ | 🔲 Not started | |
