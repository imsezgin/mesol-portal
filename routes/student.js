const express  = require('express');
const router   = express.Router();
const supabase = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

// ── GET /api/student/me ──────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  const { id } = req.student;

  // Get streak
  const { data: streak } = await supabase
    .from('streaks')
    .select('current_days, longest_days, last_activity')
    .eq('student_id', id)
    .single();

  // Get weekly stats (exercises completed + avg score this week)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: weekResults } = await supabase
    .from('results')
    .select('score, max_score, completed_at')
    .eq('student_id', id)
    .gte('completed_at', weekAgo.toISOString());

  const weeklyCount = weekResults?.length || 0;
  const avgScore = weeklyCount > 0
    ? Math.round(weekResults.reduce((sum, r) => sum + (r.score / r.max_score * 100), 0) / weeklyCount)
    : 0;

  // Get last 3 completed exercises
  const { data: recent } = await supabase
    .from('results')
    .select('exercise_id, score, max_score, completed_at')
    .eq('student_id', id)
    .order('completed_at', { ascending: false })
    .limit(3);

  res.json({
    name:        req.student.name,
    level:       req.student.level,
    programme:   req.student.programme,
    streak:      streak?.current_days || 0,
    longestStreak: streak?.longest_days || 0,
    weeklyCount,
    avgScore,
    recent:      recent || []
  });
});

// ── GET /api/student/progress ────────────────────────────────
router.get('/progress', requireAuth, async (req, res) => {
  const { id } = req.student;

  // All results
  const { data: allResults } = await supabase
    .from('results')
    .select('exercise_id, score, max_score, completed_at')
    .eq('student_id', id)
    .order('completed_at', { ascending: false });

  // Last 30 days activity map
  const activityMap = {};
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  (allResults || []).forEach(r => {
    const day = r.completed_at.split('T')[0];
    if (new Date(day) >= thirtyDaysAgo) {
      activityMap[day] = (activityMap[day] || 0) + 1;
    }
  });

  // Streak data
  const { data: streak } = await supabase
    .from('streaks')
    .select('current_days, longest_days')
    .eq('student_id', id)
    .single();

  res.json({
    totalCompleted: allResults?.length || 0,
    activityMap,
    streak:         streak?.current_days || 0,
    longestStreak:  streak?.longest_days || 0,
    results:        allResults || []
  });
});

module.exports = router;
