-- ═══════════════════════════════════════════════════════════
-- YESchool MESOL Portal — Supabase Database Setup
-- Paste this entire file into the Supabase SQL Editor and run.
-- ═══════════════════════════════════════════════════════════

-- Students table
-- Populated automatically by Make.com when a row is added to Google Sheets
CREATE TABLE IF NOT EXISTS students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_row   INT  UNIQUE NOT NULL,
  phone       TEXT UNIQUE NOT NULL,  -- E.164 format: +447700900123
  name        TEXT NOT NULL,
  level       TEXT NOT NULL CHECK (level IN ('EL1','EL2','EL3')),
  programme   TEXT NOT NULL CHECK (programme IN ('MESOL','ESOL','GE','Employer')),
  pin         TEXT NOT NULL,         -- 4-digit string
  pin_sent_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Exercise results
-- Written when a student completes any exercise
CREATE TABLE IF NOT EXISTS results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exercise_id   TEXT NOT NULL,         -- e.g. "EL1-gap-001"
  score         INT  NOT NULL,         -- correct answers
  max_score     INT  NOT NULL,         -- total questions
  time_seconds  INT,                   -- time taken (nullable)
  attempt       INT  NOT NULL DEFAULT 1,
  completed_at  TIMESTAMPTZ DEFAULT now()
);

-- Streak tracking
-- One row per student, updated on each exercise completion
CREATE TABLE IF NOT EXISTS streaks (
  student_id    UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  current_days  INT  NOT NULL DEFAULT 0,
  longest_days  INT  NOT NULL DEFAULT 0,
  last_activity DATE           -- date of most recent exercise (no time)
);

-- ── Indexes for performance ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_results_student    ON results(student_id);
CREATE INDEX IF NOT EXISTS idx_results_completed  ON results(completed_at);
CREATE INDEX IF NOT EXISTS idx_results_exercise   ON results(exercise_id);

-- ── Row Level Security (RLS) ─────────────────────────────────
-- We use our own JWT auth (not Supabase Auth), so disable RLS.
-- The anon key is used server-side only — never exposed to the browser.
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE results  DISABLE ROW LEVEL SECURITY;
ALTER TABLE streaks  DISABLE ROW LEVEL SECURITY;

-- ── Verification ─────────────────────────────────────────────
-- Run this to confirm tables exist:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- ── Test student (your phone for testing — delete before launch) ─
-- INSERT INTO students (sheet_row, phone, name, level, programme, pin)
-- VALUES (1, '+447700000000', 'Test Student', 'EL1', 'MESOL', '1234');
-- INSERT INTO streaks (student_id)
-- SELECT id FROM students WHERE phone = '+447700000000';
