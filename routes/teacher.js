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
    .select('id, phone, name, level, programme')
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

// ── POST /api/teacher/import  ──────────────────────────────
// Bulk-create students from teacher dashboard
// Body: { students: [{ name, phone, level, programme, email? }] }
router.post('/import', requireTeacher, async (req, res) => {
  const { students } = req.body;

  if (!students || !Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: 'students array required' });
  }

  const results = [];

  for (const s of students) {
    if (!s.name || !s.phone || !s.level || !s.programme) {
      results.push({ name: s.name, phone: s.phone, status: 'error', error: 'Missing required fields' });
      continue;
    }

    // Normalise phone: strip spaces, ensure +44
    let phone = s.phone.trim().replace(/\s+/g, '');
    if (phone.startsWith('0')) phone = '+44' + phone.substring(1);
    if (!phone.startsWith('+')) phone = '+44' + phone;

    // Check if already exists
    const { data: existing } = await supabase
      .from('students')
      .select('id, phone, pin')
      .eq('phone', phone)
      .single();

    if (existing) {
      results.push({ name: s.name, phone, pin: existing.pin, status: 'exists' });
      continue;
    }

    // Generate 4-digit PIN
    const pin = String(Math.floor(1000 + Math.random() * 9000));

    const { data: created, error } = await supabase
      .from('students')
      .insert({
        phone,
        name:      s.name.trim(),
        level:     s.level.trim().toUpperCase(),
        programme: s.programme.trim(),
        pin,
        sheet_row: s.sheet_row || null
      })
      .select('id, phone, name, pin')
      .single();

    if (error) {
      results.push({ name: s.name, phone, status: 'error', error: error.message });
      continue;
    }

    // Initialise streak row
    await supabase.from('streaks').insert({ student_id: created.id });

    results.push({ name: created.name, phone: created.phone, pin: created.pin, status: 'created' });
  }

  res.json({
    imported: results.filter(r => r.status === 'created').length,
    existing: results.filter(r => r.status === 'exists').length,
    errors:   results.filter(r => r.status === 'error').length,
    results
  });
});

module.exports = router;
