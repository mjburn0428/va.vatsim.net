# VATSIM Virtual Airlines Department website preview

The public website and example Partner, Associate, DOVA and Audit Manager portals.

## GitHub Pages

The ready-to-publish website is in `docs/`, including `index.html` and `.nojekyll`.
In **Settings > Pages**, select **Deploy from a branch**, **main**, and **/docs**.
The `.nojekyll` file tells Pages to publish these static files without a Jekyll build.

Expected website: https://mjburn0428.github.io/va.vatsim.net/

The `nginx/` folder contains the original source files. Update the published
copies in `docs/` when changing the preview website. The root `pages.yml` is not
needed for branch publishing.

## Preview limitations

The portal dashboards show example data; uploads and sending are disabled.
Real AMS data, VATSIM authentication, chat and reminder emails require the
backend. The Events page shows fictional sample events and an editable preview form. It never submits or saves events.
Some staff links lead to the production website.

## Public AMS count snapshots

The homepage and statistics page show real public AMS counts for Partners, Associates and DOVA, plus country totals. The retrieval date is displayed. These are snapshots, not a live API connection. Refresh reloads the published file. No credentials or representative records are included.

To update the counts, run `python flask/export_public_totals.py` in the application repository, copy `nginx/public-totals.json` into this repository's `docs/`, and commit the updated file. The application's website export also includes this snapshot.
