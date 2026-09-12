# VATSIM Virtual Airlines Department Website

The public home for VATSIM Virtual Airline Partners, Associates and Discord-only Virtual Airlines (DOVA). The website helps pilots discover virtual airlines, find community events, meet the department team and explore partnership activity.

Designed for **va.vatsim.net**, with a responsive navy and blue theme, department branding and button-style navigation.

## Explore the website

| Page | What visitors can find |
| --- | --- |
| [Home](nginx/index.html) | Department introduction, searchable virtual airline directory, program filters and Partner/Associate totals |
| [Airline statistics](nginx/statistics.html) | Partner and Associate counts with a country breakdown |
| [Audit statistics](nginx/audit-statistics.html) | Quarterly reviewed and failed audit totals |
| [Department team](nginx/team.html) | Administration Leadership, Senior Audit Managers and Audit Managers grouped by role |
| [Events](nginx/events.html) | Upcoming community events and the event submission entry point |
| [VA Portal preview](nginx/va-portal/index.html) | Example representative and Audit Manager dashboards |

The public directory includes Partners, Associates and DOVA. The headline airline statistics count Partners and Associates.

## VA community portals

Alongside the public pages, the website provides entry points for representatives and department staff:

- **VA Representatives:** follow audit progress, see their assigned manager and important dates, review requirements, upload activity evidence and read final reports.
- **Audit Managers:** access their assigned VA conversations and communicate with representatives.
- **Department staff:** reach the separate AMS staff login.

On the full application, VATSIM SSO and AMS records determine portal access. Public event listings remain available without signing in; event submissions require authorised representative access.

## Preview the website locally

1. Open this project in VS Code.
2. Open `nginx/index.html` with Live Server or your IDE's HTML preview.
3. Use the navigation to review the website pages.
4. Select **VA Portal** to explore the Partner, Associate, DOVA and Audit Manager previews.

The generated portal previews contain example data and disable uploads and message sending. Public directory, team and statistics data require the application backend, so these sections may show an unavailable message during static testing.

The events form supports local preview on localhost or file URLs. It lets you try the fields without saving a submission.

## Website files

The public website lives in `nginx/`:

| File or folder | Purpose |
| --- | --- |
| `index.html` | Main landing page and virtual airline directory |
| `main.css` | Shared colours, typography, layouts and navigation styling |
| `statistics.html`, `audit-statistics.html` | Public statistics pages |
| `team.html`, `events.html` | Department team and community events pages |
| `*.js` | Directory filters, page data loading and interactive behaviour |
| `flask-static/` | Department logos, imagery and other assets |
| `va-portal/` | Generated static portal previews |
| `associate-roster-template.csv` | Downloadable Associate roster template |

Edit the public HTML files and `main.css`, then refresh the browser to review your changes. Keep relative asset paths and folder names intact when copying the website.

Portal previews are generated from the templates in `flask/templates/`. After editing those templates, regenerate them from the repository root with `python flask/render_portal_preview.py` in an environment with Flask installed.

## Share a preview with GitHub Pages

For a separate preview repository, such as `va-dept-preview`:

1. Create the repository on GitHub.
2. Upload the **contents** of `nginx/` so that `index.html` is at the repository root. Include the website HTML, CSS and JavaScript, `favicon.ico`, the roster CSV, and the complete `flask-static/` and `va-portal/` folders.
3. Leave out `nginx.conf`, test files and operational documentation. Keep backend configuration and credentials out of the preview repository.
4. Commit the files to `main`.
5. Open **Settings > Pages** and select **Deploy from a branch**, **main**, and **/ (root)**. Click **Save**.
6. When deployment finishes, open the published link shown in the Pages settings and share it with your team.

The usual preview URL is `https://YOUR-USERNAME.github.io/va-dept-preview/`. Later commits to the publishing branch update the site. See [GitHub's publishing guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

These steps apply to a separate repository containing the website files at its root. Publishing the `nginx/` folder directly from this full repository needs a custom Pages workflow.

### What the hosted preview can show

GitHub Pages hosts the website's static pages and example portal layouts. Live VATSIM sign-in, AMS data, file uploads, chat and reminder emails require a separately hosted backend.

The event form currently detects preview mode only on local addresses and needs an adjustment for hosted form testing. Check navigation before sharing: some links lead to production services or assume the website is hosted at the domain root.

## Team review

When reviewing the website, check:

- Navigation and readability on desktop and mobile.
- Airline directory filters and how unavailable data is explained.
- The clarity of event fields and audit requirements.
- Whether representatives can easily find their manager, next steps and conversation.
- Broken links, missing images and accessibility issues.

Include the page name, browser, screen size and steps to reproduce when reporting an issue. State whether you were using a static preview or the full application.

## Further documentation

- [Public homepage and directory](nginx/HOMEPAGE.md)
- [Events](nginx/EVENTS.md)
- [VA Portal and live service setup](nginx/VA-PORTAL.md)
- [Department staff access](nginx/AMS-STAFF-ACCESS.md)
