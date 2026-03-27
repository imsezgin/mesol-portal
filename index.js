require('dotenv').config();
const express = require('express');
const path = require('path');

// ── Validate required env vars ──────────────────────────────
const REQUIRED = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'JWT_SECRET', 'TEACHER_PASSWORD', 'MAKE_SECRET'];
const missing = REQUIRED.filter(v => !process.env[v]);
if (missing.length) {
  console.error(`❌ Missing env vars: ${missing.join(', ')}`);
  console.error('   Copy .env.example to .env and fill in the values');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ──────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/student',  require('./routes/student'));
app.use('/api/results',  require('./routes/results'));
app.use('/api/students', require('./routes/students'));
app.use('/api/teacher',  require('./routes/teacher'));

// ── Page routes ─────────────────────────────────────────────
app.get('/',         (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/home',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'home.html')));
app.get('/exercise', (req, res) => res.sendFile(path.join(__dirname, 'public', 'exercise.html')));
app.get('/practice', (req, res) => res.sendFile(path.join(__dirname, 'public', 'practice.html')));
app.get('/progress', (req, res) => res.sendFile(path.join(__dirname, 'public', 'progress.html')));
app.get('/teacher',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'teacher', 'dashboard.html')));
app.get('/admin',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/help',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'help.html')));

// ── Exercise index — lists JSON files for a given level ──────
app.get('/api/exercises/:level', (req, res) => {
  const { level } = req.params;
  const dir = path.join(__dirname, 'public', 'content', level);
  const fs = require('fs');
  if (!fs.existsSync(dir)) return res.json([]);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const exercises = files.map(f => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      return { id: data.id, week: data.week, session: data.session, type: data.type, title: data.title, topic: data.topic, level: data.level };
    } catch { return null; }
  }).filter(Boolean).sort((a, b) => (a.week - b.week) || (a.session - b.session));
  res.json(exercises);
});

// ── Next uncompleted exercise for a student ───────────────────
app.get('/api/student/next-exercise', require('./middleware/auth').requireAuth, async (req, res) => {
  const supabase = require('./lib/supabase');
  const level = req.student.level;
  const fs = require('fs');
  const dir = path.join(__dirname, 'public', 'content', level);
  if (!fs.existsSync(dir)) return res.json({ id: null, level });

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  const { data: results } = await supabase.from('results').select('exercise_id').eq('student_id', req.student.id);
  const done = new Set((results || []).map(r => r.exercise_id));

  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (!done.has(data.id)) return res.json({ id: data.id, level });
    } catch {}
  }
  // All done — return first exercise
  const first = JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf8'));
  res.json({ id: first.id, level });
});
app.get('/health', (req, res) => res.json({ status: 'ok', project: 'mesol-portal', ts: new Date().toISOString() }));

// ── 404 fallback ─────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ MESOL Portal running on port ${PORT}`);
  console.log(`   http://localhost:${PORT}`);
});
