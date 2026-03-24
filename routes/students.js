const express  = require('express');
const router   = express.Router();
const supabase = require('../lib/supabase');
const { requireMakeSecret } = require('../middleware/auth');

// ── POST /api/students/create  ───────────────────────────────
// Called by Make.com when a new row appears in Google Sheets
// Headers: x-make-secret: <MAKE_SECRET>
// Body: { phone, name, level, programme, sheet_row }
router.post('/create', requireMakeSecret, async (req, res) => {
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

  // Generate 4-digit PIN
  const pin = String(Math.floor(1000 + Math.random() * 9000));

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

module.exports = router;
