# VA representative portal

Department staff access to AMS is separate from representative access. See
[AMS-STAFF-ACCESS.md](AMS-STAFF-ACCESS.md) for the staff-only AMS login policy and
required production verification.

The public site links to `/va-portal/`. VATSIM Connect verifies the member's CID;
active `VA_Representatives` assignments in AMS determine which VAs they can
represent. Upcoming approved events and their banners remain public. Event
submissions require a verified session, CSRF token and an active assignment to
the selected VA. The server supplies the airline name and submitter CID. The old
`/ap/events/request/<CID>` link redirects to the protected form; its CID is not
used as identity.

## Deployment

1. Apply the existing event migrations, then `docs/va-docs/va-portal.sql` once.
   Back up the database using your normal deployment process first. Existing
   events retain null submitter and partner references.
2. In AMS Settings → Data Model, enable the `VA_Representatives` table as a
   collection. Configure `id` as a generated UUID, `partner_id` as a relationship
   to `Partner_List` (display its Name), `vatsim_cid` as required text and `active`
   as a boolean. Give department staff management permissions. Do not grant
   public or representative roles permission to read or modify this collection.
3. Existing representative names are not sufficient for access checks. Staff
   must obtain and verify each representative's VATSIM CID, then create a mapping
   for that CID and their VA. Multiple representatives per VA and multiple VAs
   per representative are supported. Access depends on the active representative
   assignment, not `Partner_List.Status`, which can reflect a failed audit or
   website check. Representatives must retain access to read a failed outcome.
   Deactivating a mapping takes effect on the next protected request.
4. Register a VATSIM Connect OAuth client with this exact callback URL:
   `https://va.vatsim.net/va-portal/callback`. Configure server-side
   `VATSIM_CLIENT_ID`, `VATSIM_CLIENT_SECRET`, and a strong shared `APP_SECRET`.
   Set them in the deployment's secret store; never put them in browser assets.
   `VATSIM_REDIRECT_URI` defaults to the URL above. Request the `full_name` scope.
   `VATSIM_SSO_SANDBOX=true` uses the official test server and requires sandbox
   client credentials. Production defaults to `https://auth.vatsim.net`.
5. Deploy both Flask and Nginx. HTTPS is required for the Secure, HttpOnly,
   SameSite=Lax portal session cookie. All Flask workers must share APP_SECRET.
   OAuth state expires after ten minutes; sign-in expires after eight hours.
   OAuth access tokens are used on the server only and are not stored in cookies.
6. Keep the Flask service internal, and deny anonymous create/update permissions
   on `Partner_Events` in Directus, including access through `/ams/items/Partner_Events`.
   Submission ownership fields should be read-only to representatives. Keep
   banner upload folders private as described in `EVENTS.md`.
7. Verify a real SSO round trip, a linked representative submission, an unlinked
   CID denial, logout, and anonymous public listings. Live OAuth, schema migration
   and production AMS permission checks cannot be verified by local mock tests.

Missing SSO credentials, mapping tables or database access fail closed. The
portal provides linked VA access, audit progress, final reports and event submission; it does not
grant AMS staff permissions or allow representatives to edit their VA profile.

## Audit progress and final reports

The portal also displays the currently assigned Audit Manager, assignment date,
audit target date, review submission date and most recent completion date. The
requirements checklist follows the current `audit_form.html`,
`audit_form_associate.html` and `audit_form_discord.html` templates by partnership
tier. Keep those templates and `portal_audits.requirements` aligned when policy
changes. Requirements are preparation guidance, not automatic pass/fail checks.

For an active audit, the displayed due date is the actual AMS `Assigned_Date`
plus 10 calendar days, matching the assignment scheduler. It does not change
the stored assignment date or create a new one from the date of viewing. Dates
for future audits continue to use Partner_List.Audit_Due.

### Private audit conversations

Apply `docs/va-docs/va-audit-chat.sql`, then deploy Flask and Nginx. The Flask DB
account needs SELECT/INSERT on VA_Audit_Messages (and UPDATE for idempotent retry
handling). Do not grant public or representative Directus roles access to this
collection. Messages are scoped to the VA and assignment date, so later audit
cycles do not receive the previous cycle's conversation.

Representatives use their existing active CID-to-VA mapping. The assigned Audit
Manager opens **VA Portal → Audit Manager Portal** (`/va-portal/manager`),
signs in using VATSIM SSO and sees "Your assigned
audit conversations", without needing a representative mapping. Staff access
requires the current Assigned_Audits/Awaiting_Review auditor ID, matching
Audit_Managers.VATSIM_CID, an active linked Directus user, and an approved staff
role with app/admin access. Ensure staff CID records are accurate. All active
linked representatives for that VA share the conversation with its current
Audit Manager. Other staff receive no portal access merely from a staff title.

Every read and send rechecks access. Reassignment removes the former manager's
access; a completed audit closes the active portal conversation. Messages remain
stored for department retention/review, but there is no completed-conversation
archive in the portal yet. Text messages are limited to 2,000 characters. Sending
requires CSRF validation, and retries of the same message are deduplicated.
Messages refresh every 10 seconds while the page is visible. Individual messages
do not send email, Discord or push notifications. The optional unanswered-message
reminder worker is described below. Upload activity evidence
through the existing private evidence form rather than chat attachments.

The static preview shows an example chat with sending disabled. Check live
staff/representative access, reassignment, audit completion and message delivery
after deployment. These production checks have not been performed locally.

### Four-day response reminder

The portal displays a reminder policy: if no representative replies in the portal
or uploads activity evidence within **4 days (96 hours)** of the current manager's
first unanswered message, email the VA contact stored in `Partner_List.Email`.
The timer starts at the message's UTC timestamp, not the date-only assignment.
Further manager messages do not postpone it. A reply from any linked VA rep or
an evidence upload cancels that pending reminder; a subsequent manager message
starts a new waiting period. Replies outside the portal cannot be detected.

Only currently assigned audits with an active permitted manager and a linked
representative qualify. Department review/completion stops reminders. Reassignment
excludes messages from the former manager. The reminder email links to the portal
and does not include private chat contents. Sending a reminder does not change
the audit's ten-day due date or outcome.

Before enabling: apply `docs/va-docs/va-audit-reminders.sql` in addition to the chat
and activity-evidence migrations. Give the worker DB account SELECT on the
assignment, staff, representative, message and evidence tables, and SELECT/INSERT/
UPDATE on `VA_Audit_Reminders`. Keep the operational log private in AMS.
Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PW`, and
`AUDIT_REMINDER_FROM`. `AUDIT_REMINDER_SMTP_MODE` supports `starttls` (default,
typically port 587) or `ssl` (typically port 465). TLS certificates are verified.

Deploy and start the dedicated worker with:
`docker compose --profile audit-reminders up -d --build audit-response-reminders`.
It scans every five minutes, so delivery is attempted on the first scan at or
after 96 hours. Do not start schedulers inside Gunicorn workers. The profile is
opt-in; the portal wording alone does not activate email delivery. No emails are
sent by static previews or unit tests.

The log's unique message ID prevents duplicate attempts across worker instances.
An attempt is recorded before SMTP submission. Failed or interrupted attempts
remain `failed` or `sending` and require staff review rather than automatic retry,
because a timeout can occur after the mail server has accepted a message. Verify
delivery in the mail service before manually deleting a log row to permit retry.
`sent` means accepted by SMTP, not confirmed inbox delivery. A reply arriving after
the worker's final check may overlap a reminder already being submitted.

Deployment, SMTP delivery and real database concurrency have not been tested
locally. Verify a controlled recipient and the worker logs when enabling it.

### Representative activity uploads

The server reads `Partner_List.Partnership_Tier` from AMS and the portal displays
Partner (`vap`), Associate (`vaa`) or Discord-only VA (`disc`). Representatives
cannot change their tier through the upload request. The tier is rechecked when
saving, alongside membership and the audit assignment date.

Associates must upload a UTF-8 CSV roster with columns `pilot_cid,last_flight_date`.
The downloadable `associate-roster-template.csv` contains these headers. Supply
at least 10 distinct VATSIM CIDs with a last-flight date in YYYY-MM-DD format
within 90 days of upload (including the boundary date), and no future dates.
Duplicate CIDs, invalid rows and fewer than 10 pilots are rejected. Files are
limited to 5 MB and stored in the same private evidence folder. The recorded
period is the 90-day window as calculated by the server. PDF/image uploads do
not satisfy the Associate roster upload requirement. Partner and Discord-only VA
uploads keep their existing PDF/image support.

This change updates the Associate activity window from 60 to 90 days in both
the representative checklist and the staff Associate audit form, as requested.
It retains the other existing audit requirements. CSV validation checks the
submitted data; it does not independently verify real VATSIM flights or approve
an audit. The Audit Manager still verifies the roster and requirements.

Choose **Associate preview** on the local portal preview to inspect the CSV
upload fields. Deploy Flask and Nginx to enable the live checker and downloadable
template. No additional migration beyond the existing activity-evidence migration
is needed for this tier check.

Apply `docs/va-docs/va-activity-evidence.sql` before deploying this version.
Create a private AMS folder and set `VA_ACTIVITY_FOLDER_ID` in Flask. Its existing
AMS service token needs create/delete file permissions there. Keep this folder
inaccessible to public Directus roles, including direct asset URLs. Expose
`VA_Activity_Evidence` in AMS to department staff, with `file_id` configured as a
file relation and `partner_id` linked to Partner_List. Staff can filter by VA and
assignment date to review the activity evidence. Representatives do not need
AMS roles and cannot access other VAs' files through the portal.

Uploads require SSO, CSRF validation, an active representative mapping and an
ongoing assigned/review audit with an assignment date. For Partners and Discord-only VAs, PDF (not password-protected),
PNG and JPEG are supported up to 5 MB, with image dimensions limited to 20 million
pixels. Representatives do not enter start/end dates. The server records the
window ending on the upload date: 90 days for Partners/Associates and 60 days for
DOVA. Client-supplied period dates are ignored. These dates describe the required
window, not independently verified flight activity. Both the
verified submitter CID and audit assignment date are recorded. Membership and
the current audit cycle are checked again before saving the receipt. Unused
files are removed if saving fails. Uploads are evidence for staff review and do
not change the audit outcome. The portal displays the latest five receipts for
the current audit cycle. It does not email staff or send Discord messages.

The local representative preview contains one example VA and shows the upload
fields with sending disabled. Regenerate it with `python flask/render_portal_preview.py`.
Production needs both Flask and Nginx deployed after the migration, the private
folder configured, and a real upload/review check.

Apply `docs/va-docs/va-portal-audits.sql` **before** deploying these changes to
Flask. It adds `Audit_History.Report_File`, which stores the final PDF's Directus
file UUID. New completed audits store the uploaded report against the exact
history record (`count`) in the acceptance transaction. Older audits remain
visible with "Report not yet available" until staff verifies the VA and audit
date and links the correct existing PDF. Do not infer ownership from filenames.

The portal uses `Assigned_Audits` for work in progress and `Awaiting_Review` for
department review; active review takes precedence over an older completed audit.
With no active audit, a history record indicates the latest audit is complete.
The tracker describes the latest cycle; it is not a permanent timestamped log
of every stage. The last five completed audits show dates and pass/fail outcomes.
The current audit target date is labelled separately from the next scheduled
audit date; it is not presented as a representative submission deadline.

All reads use the verified session CID and an active `VA_Representatives` mapping.
No client-provided CID or VA ID establishes access. Report downloads use the
server's `AMS_API_TOKEN`, return a PDF attachment with `Cache-Control: no-store`,
and recheck membership for the specific completed audit. Internal administrative
notes and evidence are not queried. The final VA-facing PDF uses the existing
audit report contents and can include audit findings and auditor/reviewer names.

Keep report folders private in Directus, including `/ams/assets/`, `/assets/`
and file APIs, so direct asset access cannot bypass the portal's ownership check.
Configure `Report_File` as a single-file field in AMS for staff management only.
Do not permit representative/public roles to read raw Audit History or edit file
links. The Flask DB account needs SELECT on Partner_List, VA_Representatives,
Assigned_Audits, Awaiting_Review and Audit_History; the existing audit processor
also needs UPDATE on Report_File. The service token needs read access to the
private PDFs and its existing report-upload permissions.

Deploy Flask and Nginx after the migration. Verify with two different linked
representatives that neither can download the other's PDF, verify revocation,
and test a real audit completion/report download before publishing. Live schema,
file permissions and report contents have not been verified locally.

Reference: [VATSIM Connect documentation](https://vatsim.dev/services/connect/).

## Local checks

The preview navigation includes **DOVA preview** (`nginx/va-portal/dova.html`)
and **Audit Manager preview** (`nginx/va-portal/manager.html`). DOVA uses the
existing Discord-only checklist: visible VATSIM logo/link, at least 10 active
pilots in 60 days, permanent Discord invite, accessible policies and a reachable
contact. Its evidence upload accepts PDF/PNG/JPEG. The Associate CSV roster
requirement does not apply to DOVA.

The manager sign-in preview is `nginx/va-portal/manager-login.html`. Both sides
use the same live conversation API; static previews contain only example data
with sending disabled. The dedicated manager view does not require a VA
representative mapping. It shows no conversations when no current permitted
assignment matches the verified CID. Live chat still needs the migration and
AMS staff CID/account configuration described above.

For IDE preview / Live Server, open `nginx/index.html` and select **VA Portal**,
or open `nginx/va-portal/index.html` directly. The preview includes links between
the sign-in screen and an example representative dashboard. It uses the same
Flask template and stylesheet, with example data and disabled sign-in/submission
buttons. It does not connect to AMS or grant representative access.
The representative preview links to the editable local event form.

Open `nginx/events.html#submit-event` in Live Server or directly from disk to
view and edit the event request form without SSO. On localhost, loopback addresses
and file URLs, the page shows a sample VA and makes no API requests. The preview
button checks required fields without saving or submitting anything. Edit
`nginx/events.html` and `nginx/main.css`, then refresh to see changes. Keep the
Flask event template synchronized as described in `EVENTS.md`.
For testing the actual local backend and SSO, use `events.html?live=1`.
Publicly hosted pages continue to require the real SSO session for submissions.

Regenerate the preview after changing the portal template:
`python flask/render_portal_preview.py` (requires Flask).
The generated preview files are not included in the production Nginx image.
On the deployed site, the same navigation URL is handled by Flask and uses the
real SSO session and AMS permissions.

From `flask`, run `python -m unittest test_va_portal test_va_events test_audit_statistics`.
From the repository root, run `node --test nginx/events.test.cjs`.
