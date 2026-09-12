# Public homepage

The Nginx root now serves the Partners and Associates homepage instead of redirecting to vatsim.net. Rebuild and deploy `Dockerfile.nginx` through the existing deployment process to publish it.

Open `nginx/index.html` directly or through your IDE preview to review the styling. Stylesheets, scripts and the department logo use relative paths so they also load when the preview serves the repository root. The live directory still requires the Nginx API proxy; a static preview displays its unavailable message.

- `index.html`: public copy, navigation, program policy links and myVATSIM access.
- `main.css`: responsive layout and visual styling, with no external font dependencies.
- `partners.js`: anonymous directory requests, pagination, search and program filters.
- `team.js`: editorial team profiles. Populate `window.VA_TEAM` with objects containing `name`, `role`, optional `bio`, and optional `photo`. An introductory message appears until profiles are supplied. Add Docker COPY entries for any local photos.

The directory uses the existing `/api/partners` proxy and `/assets/` image route. The Directus public role must already allow reading `Name`, `Logo`, `Website_Link`, `Country`, `Callsigns`, and `Partnership_Tier` for publicly listed Partners and Associates, and their logos. No credentials are embedded, and this change does not modify backend permissions. Client field selection is not an access-control boundary; enforce public fields and record visibility in Directus. Administrative notes, contact records and audit data should remain restricted.

The main directory includes `vap` (Partners), `vaa` (Associates), and `disc` (Discord-only VAs), with separate filters and badges. The AMS public role must allow reading the `disc` records for them to appear. Statistics remain scoped to Partners and Associates. `Status` is deliberately not treated as membership status because the repository's website checker uses it for website reachability. Requests time out after 15 seconds and offer a retry on failure.

The member portal links to myVATSIM. The separate Department staff link retains `/ams/` access. Team profiles are editorial, rather than drawn from internal audit-manager records.

Run `node --test nginx/partners.test.cjs` with the workspace dependencies installed. Tests use the existing jsdom package and cover search, filters, pagination, safe text and links, image fallback, retries and team rendering.

Visual direction: inspired by Acor Air (https://www.xn--aorair-wua.pt/) with dark navy surfaces, sky-blue gradients, rounded translucent cards, pill buttons, a sticky translucent header and softer typography. The original AI-generated aviation hero is stored in `flask-static/community-hero.png` and included in the Nginx image. Relative asset paths, responsive layouts and reduced-motion support are retained.

## Department team page

The homepage now shows Partner and Associate statistics in place of the team
introduction. Its three cards use the fully loaded directory records, count
`vap` and `vaa` separately and combined, and remain independent of directory
search and filters. Discord-only VAs are excluded from these program totals.
Failed requests show unavailable figures rather than zero or partial counts.

`team.html` is the dedicated department roster, linked from **Meet the team** in
the header. `team-page.js` loads `/api/team`,
which queries AMS through the Flask service. It lists active `directus_users`
linked to `Audit_Managers` or `Sr_Audit_Managers`, plus users with the role/title
Vice President, Director, Assistant Director or Training Coordinator under Administration Leadership.
Leadership takes precedence over senior and regular audit manager membership,
so each person appears once. Leadership members are excluded from Senior Audit
Managers even when they also have an AMS senior manager record. Verify these
role/title assignments against the deployed roster.

Only names and display roles are returned. Email addresses, CIDs, internal IDs
and performance figures are excluded. Staff must have an active AMS user linked
by ID to their manager record. No schema changes or public Directus user
permissions are required. The Flask DB account needs SELECT on the four source
tables. Deploy both Flask and Nginx to enable the endpoint.

IDE/Live Server displays the page layout but cannot load live AMS profiles
without the backend proxy. Empty sections and an unavailable API are shown
separately; no example people are published. Check the deployed roster before
publication. Backend checks: `python -m unittest test_department_team` from `flask`.

## Statistics page

`statistics.html` and `statistics.js` show current Partner (`vap`), Associate (`vaa`) and combined counts, plus a country breakdown. The page reads only `Partnership_Tier` and `Country` through the existing anonymous `/api/partners` endpoint, paginates in batches of 100 sorted by record ID, and excludes other tiers. These totals reflect the records visible to the Directus public role, not private AMS records. Existing public permissions must allow these fields and sorting by ID. No permissions are changed by this feature.

The page loads on entry and provides a manual refresh with an update timestamp. Missing countries are grouped under Not specified. A failed request clears totals rather than displaying partial data or misleading zeros. Static IDE previews can show the layout but need the Nginx API proxy for real figures. Historical growth is not displayed because the public directory does not provide historical snapshots.

## Production domain

The public homepage is configured for `https://va.vatsim.net/`, with statistics at `https://va.vatsim.net/statistics.html`. AMS remains at `https://va.vatsim.net/ams/`. Nginx declares the domain as its server name, and both public pages declare their canonical URLs. Relative assets still support local previews.

Publish by building and deploying `Dockerfile.nginx` to the existing Nginx service. DNS and the HTTPS ingress must route this domain to that service. DNS, certificates and ingress configuration are outside this repository; changing the server name does not publish the site. The current Nginx configuration listens on port 80 behind the HTTPS proxy.

## Audit statistics

Failed audits are the subset of dated `Audit_History` records with `Status = 0`,
matching the audit report's failed outcome check. The API returns `failed` beside
the existing `audits` total for each quarter. The page labels that total as
reviewed audits and shows failures separately in the summary, chart and table.
Reviewer-rejected submissions awaiting correction are not completed Audit History
records and are not included. Deploy both Flask and Nginx for this change; no new
schema is required. Names, notes and failure reasons remain private.

`audit-statistics.html` shows accepted Audit History counts by quarter, with a year filter, chart and accessible table. It uses `/api/audit-statistics`, a Flask aggregate-only endpoint querying the AMS database. YEAR and QUARTER of `Last_Audit_Date` match the derivation used by `quarterly_stats_dashboard.sql`. Undated/zero-year history records are excluded, and only quarters with recorded audits are listed. Totals count history records, not unique airlines. No notes or auditor/airline identities are returned.

No new schema is required. The Flask DB account needs SELECT on `Audit_History`; rebuild/deploy both Flask and Nginx. Live data and parity with the deployed AMS dashboard still need verification. Local previews need the API proxy for figures. Backend tests: `python -m unittest test_audit_statistics` from `flask`.

## VA representative portal

`/va-portal/` provides VATSIM SSO and access based on staff-maintained CID-to-VA
assignments in AMS. Public event listings remain open; event submissions require
representative access. See [VA-PORTAL.md](VA-PORTAL.md) for the required migration,
OAuth credentials, representative setup and deployment checks.
