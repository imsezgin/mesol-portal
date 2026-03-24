# MESOL Portal — Deployment Guide

## What's Built

The complete MESOL learner portal with:
- **login.html** — Phone + PIN login (already existed)
- **home.html** — Student homepage: greeting, streak, weekly stats, recent activity, CTA
- **exercise.html** — Full exercise renderer for all 4 types: gap_fill, mcq, vocab_match, mesol_combo
- **practice.html** — Exercise library filtered by week, shows completion status
- **progress.html** — 30-day activity calendar, streak stats, topic bar chart (Canvas API)
- **teacher/dashboard.html** — Password-protected teacher dashboard with cohort table + student detail modal
- **44 exercise JSON files** in public/content/EL1/, EL2/, EL3/
- **Content listing API** at GET /api/content/:level

---

## Step 1 — Push to GitHub

Open Terminal on your Mac and run:

```bash
cd ~/Desktop/mesol-portal-deploy
git init
git add .
git commit -m "initial commit — full MESOL portal"

# Create repo on GitHub (requires gh CLI — install with: brew install gh)
gh repo create mesol-portal --public --source=. --remote=origin --push
```

If you don't have `gh` CLI, create the repo manually at github.com/new, then:
```bash
git remote add origin https://github.com/YOUR_USERNAME/mesol-portal.git
git branch -M main
git push -u origin main
```

---

## Step 2 — Deploy on Railway

1. Go to https://railway.app → **New Project → Deploy from GitHub**
2. Select the `mesol-portal` repo
3. Add these **environment variables** in Railway Settings → Variables:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://yzbowlpcqtpabpcnlivg.supabase.co` |
| `SUPABASE_ANON_KEY` | *(your Supabase anon key)* |
| `JWT_SECRET` | *(any random string, e.g. `mesol-jwt-yes-2026-secret`)* |
| `TEACHER_PASSWORD` | *(whatever password Tim/you will use)* |
| `MAKE_SECRET` | `make-yes-2026-secret` |
| `PORT` | `3000` |

4. Add custom domain: **mesol.yeschool.uk**
5. Railway will give you a CNAME target — add a CNAME record for subdomain `mesol` at your domain registrar

---

## Step 3 — Insert Test Student in Supabase

Go to Supabase SQL Editor and run:

```sql
INSERT INTO students (sheet_row, phone, name, level, programme, pin)
VALUES (1, '+447700000000', 'Test Student', 'EL1', 'MESOL', '1234');

INSERT INTO streaks (student_id)
SELECT id FROM students WHERE phone = '+447700000000';
```

Then visit **mesol.yeschool.uk** on your phone:
- Enter phone: `7700000000`
- Enter PIN: `1234`
- Should redirect to the homepage

---

## Step 4 — Make.com Automation

### Scenario 1: New Student Enrolment
- Trigger: Google Sheets → Watch New Rows (student master sheet)
- HTTP POST to `https://mesol.yeschool.uk/api/students/create`
  - Header: `x-make-secret: make-yes-2026-secret`
  - Body: `{ "phone": "{{phone}}", "name": "{{name}}", "level": "{{level}}", "programme": "{{programme}}", "sheet_row": "{{row_number}}" }`
- GHL → Send WhatsApp to `{{phone}}`:
  `Welcome to YESchool! Your practice portal is ready at mesol.yeschool.uk — your PIN: {{pin}}`

### Scenario 2: Daily Results Sync
- Trigger: Schedule → every day at 06:00
- HTTP GET `https://mesol.yeschool.uk/api/results/daily-summary`
  - Header: `x-make-secret: make-yes-2026-secret`
- Google Sheets → Update Row (match on phone) with exercises_completed, avg_score, last_active
