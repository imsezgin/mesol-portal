const express  = require('express');
const router   = express.Router();
const supabase = require('../lib/supabase');
const { requireTeacher } = require('../middleware/auth');

// ── GET /api/teacher/cohort  ─────────────────────────────────
// Returns all students with their weekly stats for the dashboard
router.get('/cohort', requireTeacher, async (req, res) => {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Get all students
  const { data: students, error } = await supabase
    .from('students')
    .select('id, phone, name, level, programme, pin')
    .order('name');

  if (error) return res.status(500).json({ error: error.message });

  // Get all results from last 7 days
  const { data: weekResults } = await supabase
    .from('results')
    .select('student_id, score, max_score, completed_at')
    .gte('completed_at', weekAgo.toISOString());

  // Get all streaks
  const { data: streaks } = await supabase
    .from('streaks')
    .select('student_id, current_days, last_activity');

  // Build lookup maps
  const resultsByStudent = {};
  (weekResults || []).forEach(r => {
    if (!resultsByStudent[r.student_id]) resultsByStudent[r.student_id] = [];
    resultsByStudent[r.student_id].push(r);
  });

  const streakByStudent = {};
  (streaks || []).forEach(s => { streakByStudent[s.student_id] = s; });

  // Assemble cohort
  const cohort = students.map(s => {
    const results = resultsByStudent[s.id] || [];
    const streak  = streakByStudent[s.id];
    const avgScore = results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + (r.score / r.max_score * 100), 0) / results.length)
      : null;

    return {
      id:          s.id,
      name:        s.name,
      level:       s.level,
      programme:   s.programme,
      phone:       s.phone,
      pin:         s.pin,
      weeklyCount: results.length,
      avgScore,
      streak:      streak?.current_days || 0,
      lastActive:  streak?.last_activity || null
    };
  });

  res.json({ cohort, total: cohort.length, asOf: new Date().toISOString() });
});

// ── GET /api/teacher/student/:id  ────────────────────────────
// Full result history for one student (click-through from dashboard)
router.get('/student/:id', requireTeacher, async (req, res) => {
  const { id } = req.params;

  const { data: student } = await supabase
    .from('students')
    .select('name, level, programme, phone, created_at')
    .eq('id', id)
    .single();

  const { data: results } = await supabase
    .from('results')
    .select('exercise_id, score, max_score, time_seconds, attempt, completed_at')
    .eq('student_id', id)
    .order('completed_at', { ascending: false });

  const { data: streak } = await supabase
    .from('streaks')
    .select('current_days, longest_days, last_activity')
    .eq('student_id', id)
    .single();

  res.json({ student, results: results || [], streak });
});

module.exports = router;
