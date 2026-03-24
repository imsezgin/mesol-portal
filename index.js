require('dotenv').config();
const express = require('express');
const path = require('path');

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

// ── Content listing API (returns exercise metadata for a level) ──
const fs = require('fs');
app.get('/api/content/:level', (req, res) => {
  const level = req.params.level.toUpperCase();
  const dir = path.join(__dirname, 'public', 'content', level);

  if (!fs.existsSync(dir)) {
    return res.status(404).json({ error: 'Level not found' });
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const exercises = files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    return {
      id: data.id,
      week: data.week,
      session: data.session,
      level: data.level,
      type: data.type,
      topic: data.topic,
      title: data.title
    };
  });

  // Sort by week then session
  exercises.sort((a, b) => a.week - b.week || a.session - b.session);
  res.json(exercises);
});

// ── Page routes ─────────────────────────────────────────────
app.get('/',         (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/home',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'home.html')));
app.get('/exercise', (req, res) => res.sendFile(path.join(__dirname, 'public', 'exercise.html')));
app.get('/practice', (req, res) => res.sendFile(path.join(__dirname, 'public', 'practice.html')));
app.get('/progress', (req, res) => res.sendFile(path.join(__dirname, 'public', 'progress.html')));
app.get('/teacher',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'teacher', 'dashboard.html')));
app.get('/login',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

// ── Health check (Railway uses this) ────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', project: 'mesol-portal', ts: new Date().toISOString() }));

// ── 404 fallback ─────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ MESOL Portal running on port ${PORT}`);
  console.log(`   http://localhost:${PORT}`);
});
