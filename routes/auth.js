const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const supabase = require('../lib/supabase');

// ── POST /api/auth/login  (student) ─────────────────────────
router.post('/login', async (req, res) => {
  const { phone, pin } = req.body;
  if (!phone || !pin) return res.status(400).json({ error: 'Phone and PIN required' });
  const normPhone = phone.trim().replace(/\s+/g, '');
  const { data: student, error } = await supabase.from('students').select('id, phone, name, level, programme, pin').eq('phone', normPhone).single();
  if (error || !student) return res.status(401).json({ error: 'Phone number not found' });
  if (student.pin !== pin.trim()) return res.status(401).json({ error: 'Incorrect PIN' });
  const token = jwt.sign({ id: student.id, phone: student.phone, name: student.name, level: student.level, programme: student.programme }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, name: student.name, level: student.level, programme: student.programme });
});

// ── POST /api/auth/teacher  (staff: admin or teacher) ───────
router.post('/teacher', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  // Use ILIKE for case-insensitive email lookup
  const { data: user, error } = await supabase
    .from('staff')
    .select('id, name, email, password, role')
    .ilike('email', email.trim())
    .single();

  if (error || !user) {
    if (password === process.env.TEACHER_PASSWORD && !email) {
       const token = jwt.sign({ role: 'teacher', name: 'Admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
       return res.json({ token, name: 'Admin', role: 'teacher' });
    }
    return res.status(401).json({ error: 'User not found' });
  }

  if (user.password !== password.trim()) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, name: user.name, role: user.role });
});

// ── POST /api/auth/forgot-pin  ───────────────────────────────
router.post('/forgot-pin', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone required' });
  const normPhone = phone.trim().replace(/\s+/g, '');
  const { data: student, error } = await supabase.from('students').select('id, name, phone').eq('phone', normPhone).single();
  if (error || !student) return res.status(404).json({ error: 'Phone number not found' });
  const pin = String(Math.floor(1000 + Math.random() * 9000));
  await supabase.from('students').update({ pin, pin_sent_at: new Date().toISOString() }).eq('id', student.id);
  res.json({ success: true, message: 'New PIN generated' });
});

module.exports = router;
