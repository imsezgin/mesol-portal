const express  = require('express');
const router   = express.Router();
const supabase = require('../lib/supabase');
const { requireMakeSecret, requireTeacher } = require('../middleware/auth');

// ── POST /api/students/create  ───────────────────────────────
// Called by Make.com (x-make-secret) or Admin panel (teacher JWT)
// Body: { phone, name, level, programme, sheet_row }
function requireMakeOrTeacher(req, res, next) {
  // Try Make secret first
  const secret = req.headers['x-make-secret'];
  if (secret && secret === process.env.MAKE_SECRET) return next();
  // Fall back to teacher JWT
  return requireTeacher(req, res, next);
}
router.post('/create', requireMakeOrTeacher, async (req, res) => {
  const { phone, name, level, programme, sheet_row } = req.body;

  if (!phone || !name || !level || !programme || !sheet_row) {
    return res.status(400).json({ error: 'phone, name, level, programme, sheet_row all required' });
  }

  // Check if student already exists
  const { data: existing } = await supabase
    .from('students')
    .select('id, phone')
    .eq('phone', phone.trim())
    .single();

  if (existing) {
    return res.json({ success: true, action: 'already_exists', id: existing.id });
  }

  // Use provided PIN or generate one (4-digit birth year or random)
  const pin = (req.body.pin && /^\d{4}$/.test(req.body.pin))
    ? req.body.pin
    : String(Math.floor(1000 + Math.random() * 9000));

  const { data: student, error } = await supabase
    .from('students')
    .insert({
      phone:      phone.trim(),
      name:       name.trim(),
      level:      level.trim().toUpperCase(),   // EL1, EL2, EL3
      programme:  programme.trim(),              // MESOL, ESOL, GE
      pin,
      sheet_row,
      pin_sent_at: new Date().toISOString()
    })
    .select('id, phone, name, pin')
    .single();

  if (error) {
    console.error('Student create error:', error);
    return res.status(500).json({ error: 'Failed to create student' });
  }

  // Initialise streak row
  await supabase.from('streaks').insert({ student_id: student.id });

  // Return PIN so Make.com can pass it to GHL for WhatsApp delivery
  res.json({
    success: true,
    action:  'created',
    id:      student.id,
    phone:   student.phone,
    name:    student.name,
    pin:     student.pin   // Make.com uses this to send the WhatsApp message
  });
});

// ── POST /api/students/:id/reset-pin  ────────────────────────
// Called by admin page to reset a student's PIN
router.post('/:id/reset-pin', requireTeacher, async (req, res) => {
  const { id } = req.params;
  const requestedPin = req.body.pin;
  const pin = (requestedPin && /^\d{4}$/.test(requestedPin))
    ? requestedPin
    : String(Math.floor(1000 + Math.random() * 9000));

  const { data: student, error } = await supabase
    .from('students')
    .update({ pin, pin_sent_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, phone, name, pin')
    .single();

  if (error || !student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  res.json({
    success: true,
    id:      student.id,
    phone:   student.phone,
    name:    student.name,
    pin:     student.pin,
    message: `New PIN for ${student.name}: ${student.pin} — send to ${student.phone}`
  });
});

// ── GET /api/students  ───────────────────────────────────────
// Returns all students with PINs — teacher only
router.get('/', requireTeacher, async (req, res) => {
  const { data: students, error } = await supabase
    .from('students')
    .select('id, phone, name, level, programme, pin, pin_sent_at, created_at')
    .order('name');

  if (error) return res.status(500).json({ error: error.message });
  res.json({ students });
});

module.exports = router;
