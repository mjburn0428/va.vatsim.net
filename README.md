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
backend. Event form preview mode currently supports local addresses only.
Some staff links lead to the production website.
