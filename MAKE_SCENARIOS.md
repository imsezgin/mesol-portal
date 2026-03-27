# Make.com Scenario Specs — MESOL Portal
# YESchool | March 2026

## SCENARIO 1 — New Student Enrolment
## Trigger: Google Sheets new row → create portal account → send WhatsApp PIN

### Step-by-step in Make.com:

1. TRIGGER: Google Sheets — Watch New Rows
   - Connection: your Google account
   - Spreadsheet: [YESchool Student Master Sheet]
   - Sheet: Sheet1 (or whichever tab has student data)
   - Columns to map:
     - Column A → Name
     - Column B → Phone
     - Column C → Level  (must be EL1, EL2, or EL3)
     - Column D → Programme  (must be MESOL, ESOL, or GE)
     - Column E → Email (optional)
     - Row number → Sheet Row

2. ACTION: HTTP — Make a request
   - URL: https://mesol.yeschool.uk/api/students/create
   - Method: POST
   - Headers:
       Content-Type: application/json
       x-make-secret: make-yes-2026-secret
   - Body (JSON):
     {
       "name": "{{Name}}",
       "phone": "{{Phone}}",
       "level": "{{Level}}",
       "programme": "{{Programme}}",
       "sheet_row": {{Row Number}}
     }
   - Parse response: YES
   - Response stores: pin, name, phone, id, action

3. FILTER: Only continue if action = "created"
   - Condition: {{action}} = "created"
   - This prevents sending WhatsApp to students who already exist

4. ACTION: GoHighLevel (HTTP or GHL module)
   - Send WhatsApp message
   - To: {{phone}} from step 2 response
   - Message:
     "Hello {{name}}! Welcome to YESchool.
     
     Your practice portal is ready at:
     mesol.yeschool.uk
     
     Your PIN: {{pin}}
     
     Login with your phone number and this PIN.
     
     Questions? Reply to this message or email info@yeschool.uk"
   
   NOTE: Use GHL HTTP API if no native module available:
   - URL: https://rest.gohighlevel.com/v1/conversations/messages
   - Method: POST
   - Headers:
       Authorization: Bearer [GHL_API_KEY]
       Content-Type: application/json
   - Body:
     {
       "type": "WhatsApp",
       "contactId": "{{contact_id}}",
       "message": "..."
     }

---

## SCENARIO 2 — Daily Results Sync to Google Sheets
## Trigger: Schedule (6am daily) → fetch results → update Sheets

### Step-by-step in Make.com:

1. TRIGGER: Schedule
   - Interval: Every day
   - Time: 06:00 AM (UK time — set timezone to Europe/London)

2. ACTION: HTTP — Make a request
   - URL: https://mesol.yeschool.uk/api/results/daily-summary
   - Method: GET
   - Headers:
       x-make-secret: make-yes-2026-secret
   - Parse response: YES
   - Response contains: { date, summary: [ {phone, name, level, programme, count, avgScore} ] }

3. ACTION: Tools — Set Variable
   - Variable name: summary
   - Variable value: {{summary}} (array from step 2)

4. ACTION: Google Sheets — Update a Row (inside iterator)
   - First add: Iterator module to loop through summary array
   - For each student in summary:
     - Spreadsheet: [YESchool Student Master Sheet]
     - Sheet: Sheet1
     - Search Column: B (Phone)
     - Search Value: {{phone}}
     - Update these columns:
         Column F → Exercises completed ({{count}})
         Column G → Avg score % ({{avgScore}})
         Column H → Last active ({{date}})

---

## SCENARIO 3 — PIN Reset Notification (optional, add later)
## Trigger: Webhook from portal → send new PIN via WhatsApp

1. TRIGGER: Webhooks — Custom webhook
   - Copy the webhook URL Make.com gives you
   - Paste it as MAKE_PIN_RESET_WEBHOOK in Railway env vars

2. ACTION: GoHighLevel — Send WhatsApp
   - To: {{phone}}
   - Message:
     "Your YESchool portal PIN has been reset.
     New PIN: {{pin}}
     Login at mesol.yeschool.uk"

---

## GOOGLE SHEETS COLUMN STRUCTURE (recommended)

| Col | Header | Notes |
|-----|--------|-------|
| A | Name | Full name |
| B | Phone | Format: 07700900123 (Make.com normalises to +44) |
| C | Level | EL1, EL2, or EL3 |
| D | Programme | MESOL, ESOL, or GE |
| E | Email | Optional |
| F | Exercises Completed | Updated by Scenario 2 daily |
| G | Avg Score % | Updated by Scenario 2 daily |
| H | Last Active | Updated by Scenario 2 daily |
| I | Portal Created | Set by Scenario 1 when account created |
| J | Notes | Manual notes by Gwyn/admin |

---

## IMPORTANT NOTES

- GHL Location ID: tiN9OI0ta4vlQwtZ39yO
- Make secret: make-yes-2026-secret (must match Railway env var MAKE_SECRET)
- Portal URL: https://mesol.yeschool.uk
- Supabase project: yzbowlpcqtpabpcnlivg
- Admin page: https://mesol.yeschool.uk/admin (use TEACHER_PASSWORD to login)
- Manual PIN reset: go to /admin → find student → click Reset PIN
