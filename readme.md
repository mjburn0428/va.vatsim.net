# VATSIM Virtual Airlines Department

Public website, VA Representative Portal and Audit Manager Portal for the VATSIM Virtual Airlines Department. The application combines a static Nginx website, a Python/Flask backend and a customised Directus Airline Management System (AMS).

## Features

- Public directory of Partners, Associates and Discord-only Virtual Airlines (DOVA).
- Department team page, airline statistics and quarterly audit statistics.
- Public event listings with authenticated representative submissions.
- VA audit progress, assigned Audit Manager, important dates and final reports.
- Tier-specific requirements and private activity evidence uploads.
- Private conversations between a VA's representatives and its assigned Audit Manager.
- Optional reminder emails after 4 days (96 hours) without a portal response.

## Repository layout

| Location | Purpose |
| --- | --- |
| `nginx/` | Public pages, styles, JavaScript, images and generated portal previews |
| `flask/` | Backend routes, authentication, templates, audit processing and tests |
| `docs/va-docs/` | Database migrations and department technical documentation |
| `api/`, `app/`, `directus/` | Directus AMS source and packages |
| `Dockerfile.nginx`, `Dockerfile.flask`, `Dockerfile.ams` | Container builds |
| `docker-compose.yml` | Service configuration and optional reminder worker |

## Preview locally

Open `nginx/index.html` using VS Code Live Server or your IDE's HTML preview. Select **VA Portal** to explore the example dashboards without signing in.

| Preview | File |
| --- | --- |
| Portal entry | [Sign-in preview](nginx/va-portal/index.html) |
| Partner representative | [Partner preview](nginx/va-portal/representative.html) |
| Associate representative | [Associate preview](nginx/va-portal/associate.html) |
| DOVA representative | [DOVA preview](nginx/va-portal/dova.html) |
| Audit Manager | [Manager preview](nginx/va-portal/manager.html) |

These pages use example data. Uploads and message sending are disabled. Public pages that need AMS may display an unavailable message without the backend.

Edit `flask/templates/va_portal.html` and `flask/templates/portal_chat.html` for portal layout changes, then regenerate the static previews from the repository root:

```sh
python -m pip install -r flask/requirements.txt
python flask/render_portal_preview.py
```

Refresh the browser after regeneration. Edit `nginx/main.css` for shared styling. The event form at `nginx/events.html#submit-event` supports a local preview on localhost or file URLs.

## Publish a preview on GitHub Pages

GitHub Pages can host the static website and generated portal previews. It cannot run the Flask backend or AMS. Actual VATSIM login, uploads, chat, database statistics and reminder emails need separately hosted services.

For a simple preview, create a **separate repository** named something like `va-dept-preview`:

1. Create the repository on GitHub. A public repository supports Pages on GitHub Free.
2. Select **Add file → Upload files**.
3. Upload the website files from **inside** `nginx/`, so `index.html` is at the new repository's root. Include the HTML, CSS and JavaScript files, `favicon.ico`, `associate-roster-template.csv`, and the complete `flask-static/` and `va-portal/` folders. Preserve their folder structure.
4. Leave out `nginx.conf`, test files and operational Markdown documents. Backend files, credentials and the existing container build workflows are not part of this static preview.
5. Commit the files to `main`.
6. Open **Settings → Pages**. Choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
7. Once deployment completes, use the site link shown under **Settings → Pages**. Check the **Actions** tab if deployment fails.

The typical address is `https://YOUR-USERNAME.github.io/va-dept-preview/`. Open its `va-portal/index.html` page to reach the example dashboards. Future commits to the publishing branch update the preview.

Branch publishing supports the repository root or a `/docs` folder. Publishing directly from this repository's `nginx/` folder requires a custom GitHub Actions workflow; the existing workflows build containers and do not publish Pages. See [GitHub's publishing instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

### Current preview limitations

- API-backed directory, team and statistics pages need the running backend for real data.
- Event form preview detection currently recognises local addresses, not GitHub Pages. It needs an explicit hosted-preview adjustment before your team can try that form on Pages.
- Some application links may point to production or assume a domain-root deployment. Verify navigation under the repository URL before sharing it.
- Generated portal previews use sample data and do not grant access to AMS or a live VA account.

## Run the full application

The full site requires Nginx, Flask, AMS, its database and file storage. Configure the environment variables referenced in `docker-compose.yml`, apply the relevant database migrations, and configure VATSIM SSO and AMS permissions before deploying the containers.

Representatives use VATSIM SSO and an active CID-to-VA mapping in AMS. Assigned Audit Managers use VATSIM SSO with a matching staff CID, active AMS account and current audit assignment. Representatives do not need an AMS staff role.

Use these guides for configuration and deployment details:

- [VA Portal, audit evidence, chat and reminder setup](nginx/VA-PORTAL.md)
- [AMS staff access](nginx/AMS-STAFF-ACCESS.md)
- [Events and submission setup](nginx/EVENTS.md)
- [Homepage and public directory](nginx/HOMEPAGE.md)
- [Database migrations](docs/va-docs/)
- [Upstream Directus documentation](directus/readme.md)

The reminder worker is opt-in through the `audit-reminders` Compose profile. It requires its database migration and SMTP configuration; the notice in a preview does not enable email delivery.

## Checks

After installing the Python requirements, run backend tests from the repository root:

```sh
python -m unittest discover -s flask -p "test_*.py"
```

Frontend tests are the `*.test.cjs` files in `nginx/` and use Node.js with the repository's JavaScript dependencies installed. For example:

```sh
node --test nginx/portal-chat.test.cjs
```

Local previews and unit tests do not verify live SSO, production database permissions or email delivery. Use a separately configured staging backend for those checks.
