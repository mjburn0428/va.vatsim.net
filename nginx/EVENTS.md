# VA events

Public page: `https://va.vatsim.net/events.html`. The page lists approved upcoming/ongoing events in UTC. Submissions require VATSIM SSO and an active AMS representative assignment for the selected VA; see [VA-PORTAL.md](VA-PORTAL.md) for the required migration and configuration. The server records the verified CID and supplies the VA name from AMS. Submissions do not send emails or Discord messages.

## Enable in deployment

1. Apply `docs/va-docs/events-schema.sql` once to the existing AMS database. It adds fields to the baseline `Partner_Events` table. Review against the live schema first if this table has already been extended. This migration has not been run by Codex.
2. In AMS, grant the department reviewer role read/update access to `Partner_Events`. Keep public collection permissions disabled, especially for `contact_email` and status updates. Refresh the Directus schema cache/restart AMS after applying the SQL. Existing Directus collection metadata already includes `Partner_Events` in the baseline database.
3. Review submissions in `/ams/admin/content/Partner_Events`. Check the event and VA details, then set `status` to `approved` to publish, or `rejected` to hide. Pending is the enforced submission default. Staff can edit details or withdraw an event by changing its status. The public API only selects approved events whose end time has not passed.
4. Build/deploy both Flask and Nginx images. `/api/events` proxies to Flask `/public-events`. The Flask DB account needs SELECT and INSERT privileges on `Partner_Events`; the application does not run schema changes automatically.
5. Verify listing, submission and review with the deployed database. The static IDE preview cannot store submissions or list live events.

The public API selects explicit fields and never returns contact email. It validates lengths, UTC times, region, email and HTTP(S) links, uses parameterized SQL and holds submissions for review. Regions are Americas, EMEA and APAC. Banners are optional PNG/JPEG/WebP uploads up to 5 MB and 20 megapixels, validated by Pillow rather than trusting file extensions. Nginx permits multipart requests up to 6 MB; Flask enforces the file limit. Only the configured AMS service receives uploads and serves stored banners; user-supplied URLs are never fetched.

## Region and banner upgrade

Apply `docs/va-docs/events-region-banner.sql` once after the initial schema migration, including on new installations. Existing events have no region/banner until staff updates them. Configure `region` as an AMS dropdown (Americas, EMEA, APAC), and `banner_file` as a File (M2O) field linked to `directus_files` for reviewer previews.

Create a dedicated **private** event-banner folder in AMS and set its UUID as `EVENT_BANNER_FOLDER_ID` for Flask. Ensure public file/asset permissions exclude this folder, including access through `/assets/` and `/ams/assets/`. Allow staff to read it. The existing server-only `AMS_API_TOKEN` needs file create/read/delete access in that folder; `AMS_URL` points to AMS. Banner submissions fail safely if the folder or token is missing. Without a banner, submissions do not require file-service access.

Approved banners are served via `/api/events/<event-id>/banner`; pending/rejected events return 404 there. The endpoint rechecks approval on every request. The banner file stays private in Directus even after approval. The public listing does not expose the underlying file UUID. Rebuild Flask to install Pillow, and redeploy Nginx for the upload limit and banner route. Test live upload, staff preview, and approval before enabling public submissions. These database and AMS configuration changes have not been applied automatically.

Nginx limits requests to 10/minute with a burst of 10 per connection IP and blocks events API access through the `/ap/` and `/docs/` aliases. Behind an ingress, configure trusted real-client-IP handling at the infrastructure layer; without it requests may share the ingress IP limit. Keep the Flask service internal.

Run backend tests from `flask`: `python -m unittest test_va_events`.

The legacy `/ap/events/request/<VATSIMCID>` route redirects to `/va-portal/events`, which requires SSO and representative access. The URL CID is not used as proof of identity. The Jotform integration has been removed. `Dockerfile.flask` copies the public page into `event_requests.html` at build time and converts relative asset/navigation URLs to root-relative URLs. For local Flask development, keep `flask/templates/event_requests.html` synchronized with that conversion when changing `nginx/events.html`. Both pages require the Nginx frontend assets and API proxy.

## Country / division upgrade

Apply `docs/va-docs/events-country.sql` once after the two earlier events migrations. Both forms now require Country / Division using the 20 supplied VATSIM division options. The API validates against the same exact allowlist (`COUNTRIES` in `flask/va_events.py`), saves the selection in `Partner_Events.country`, and exposes it on approved event cards. Configure the corresponding AMS field as a dropdown with those values. Existing events may keep a NULL value until staff fills it in. Migration and deployment have not been applied automatically.
