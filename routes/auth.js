const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const supabase = require('../lib/supabase');

// ── POST /api/auth/login  (student) ─────────────────────────
// Body: { phone, pin }
router.post('/login', async (req, res) => {
  const { phone, pin } = req.body;

  if (!phone || !pin) {
    return res.status(400).json({ error: 'Phone and PIN required' });
  }

  // Normalise phone: strip spaces, ensure +44 format
  const normPhone = phone.trim().replace(/\s+/g, '');

  const { data: student, error } = await supabase
    .from('students')
    .select('id, phone, name, level, programme, pin')
    .eq('phone', normPhone)
    .single();

  if (error || !student) {
    return res.status(401).json({ error: 'Phone number not found' });
  }

  if (student.pin !== pin.trim()) {
    return res.status(401).json({ error: 'Incorrect PIN' });
  }

  const token = jwt.sign(
    { id: student.id, phone: student.phone, name: student.name, level: student.level, programme: student.programme },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, name: student.name, level: student.level, programme: student.programme });
});

// ── POST /api/auth/teacher  (teacher) ───────────────────────
// Body: { password }
router.post('/teacher', (req, res) => {
  const { password } = req.body;

  if (!password || password !== process.env.TEACHER_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const token = jwt.sign(
    { role: 'teacher' },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({ token });
});

// ── POST /api/auth/forgot-pin  ───────────────────────────────
// Student requests a new PIN by phone number
// Generates new PIN, updates DB, triggers WhatsApp via GHL
router.post('/forgot-pin', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone required' });

  const normPhone = phone.trim().replace(/\s+/g, '');

  const { data: student, error } = await supabase
    .from('students')
    .select('id, name, phone')
    .eq('phone', normPhone)
    .single();

  if (error || !student) {
    return res.status(404).json({ error: 'Phone number not found' });
  }

  // Generate new PIN
  const pin = String(Math.floor(1000 + Math.random() * 9000));

  await supabase
    .from('students')
    .update({ pin, pin_sent_at: new Date().toISOString() })
    .eq('id', student.id);

  // TODO: send WhatsApp via GHL when Make.com webhook is configured
  // For now: log the PIN so it can be communicated manually
  console.log(`PIN reset for ${student.name} (${student.phone}): ${pin}`);

  res.json({ success: true, message: 'New PIN generated' });
});

module.exports = router;
