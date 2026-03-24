const express  = require('express');
const router   = express.Router();
const supabase = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

// ── POST /api/results  ───────────────────────────────────────
// Save a completed exercise result + update streak
router.post('/', requireAuth, async (req, res) => {
  const { exercise_id, score, max_score, time_seconds, attempt } = req.body;
  const student_id = req.student.id;

  if (!exercise_id || score === undefined || !max_score) {
    return res.status(400).json({ error: 'exercise_id, score, and max_score required' });
  }

  // Save result
  const { error } = await supabase
    .from('results')
    .insert({ student_id, exercise_id, score, max_score, time_seconds: time_seconds || null, attempt: attempt || 1 });

  if (error) {
    console.error('Result save error:', error);
    return res.status(500).json({ error: 'Failed to save result' });
  }

  // Update streak
  await updateStreak(student_id);

  res.json({ success: true });
});

// ── GET /api/results/daily-summary  ─────────────────────────
// Used by Make.com to sync yesterday's results to Google Sheets
router.get('/daily-summary', async (req, res) => {
  // Basic protection: check for Make secret in header
  const secret = req.headers['x-make-secret'];
  if (!secret || secret !== process.env.MAKE_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dayStr = yesterday.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('results')
    .select(`
      score, max_score, completed_at, exercise_id,
      students ( phone, name, level, programme )
    `)
    .gte('completed_at', `${dayStr}T00:00:00Z`)
    .lte('completed_at', `${dayStr}T23:59:59Z`);

  if (error) return res.status(500).json({ error: error.message });

  // Aggregate by student
  const byStudent = {};
  (data || []).forEach(r => {
    const phone = r.students.phone;
    if (!byStudent[phone]) {
      byStudent[phone] = {
        phone,
        name:       r.students.name,
        level:      r.students.level,
        programme:  r.students.programme,
        count:      0,
        totalPct:   0
      };
    }
    byStudent[phone].count++;
    byStudent[phone].totalPct += (r.score / r.max_score) * 100;
  });

  const summary = Object.values(byStudent).map(s => ({
    ...s,
    avgScore: Math.round(s.totalPct / s.count)
  }));

  res.json({ date: dayStr, summary });
});

// ── Helper: update streak ─────────────────────────────────────
async function updateStreak(student_id) {
  const today = new Date().toISOString().split('T')[0];

  const { data: existing } = await supabase
    .from('streaks')
    .select('current_days, longest_days, last_activity')
    .eq('student_id', student_id)
    .single();

  if (!existing) {
    // First ever activity
    await supabase.from('streaks').insert({
      student_id, current_days: 1, longest_days: 1, last_activity: today
    });
    return;
  }

  if (existing.last_activity === today) return; // Already counted today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const newCurrent = existing.last_activity === yesterdayStr
    ? existing.current_days + 1   // Continuing streak
    : 1;                           // Streak broken — reset

  const newLongest = Math.max(newCurrent, existing.longest_days);

  await supabase.from('streaks').update({
    current_days: newCurrent,
    longest_days: newLongest,
    last_activity: today
  }).eq('student_id', student_id);
}

module.exports = router;
