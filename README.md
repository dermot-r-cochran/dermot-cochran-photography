# Dermot Cochran Photography

Personal photography portfolio, built as a static site with [Eleventy](https://www.11ty.dev/).

## Content model

Each photo is a Markdown file under `src/photos/`, with front matter:

```yaml
layout: photo.njk
title: "Ladybird on Thistle"
category: "Macro"
location: "Dublin, Ireland"
year: 2026
album: "Thistles & Ladybirds"
image: "dsc_1000.jpg"   # file under src/images/photos/
alt: "A ladybird resting on a spiky thistle seed head"
order: 1
```

The image itself lives under `src/images/photos/`. Eleventy groups photos into
`/category/<slug>/`, `/location/<slug>/`, `/year/<yyyy>/`, and `/albums/<slug>/`
archive pages automatically from these fields (see `.eleventy.js`); adding a
new photo file is all that's needed to have it show up everywhere.

## Development

```bash
npm install
npm run start   # serve locally with live reload
npm run build   # build to _site/
npm test        # Eleventy dry-run build
```

## Deployment

The site is hosted at [dermotcochran.com](https://dermotcochran.com) via
cPanel's [Git Version Control](https://docs.cpanel.net/knowledge-base/web-services/guide-to-git-deployment/)
feature: cPanel itself clones this repository and, on every deploy (pull),
runs `.cpanel.yml`'s single task, which invokes `scripts/cpanel-deploy.sh`.
That script installs a local Node.js runtime if needed (`scripts/ensure-node.sh`),
runs `npm ci` and the Eleventy build, then `rsync`s `_site/` to
`/home/<CPANEL_USER>/public_html/` and verifies `index.html`, `.htaccess`,
and `.well-known/security.txt` all made it across. It always emails a
deploy-log to `ADMIN_EMAIL` (success or failure) and keeps the last 20 runs'
logs in the untracked `deploy-logs/`.

### One-time cPanel setup

1. In cPanel, under **Git Version Control**, create a repository pointing at
   this GitHub repo (`https://github.com/dermot-r-cochran/dermot-cochran-photography.git`),
   cloned to a path outside `public_html/`.
2. In that clone, copy `sample-deploy.conf` to `deploy.conf` and set
   `CPANEL_USER`, `DOMAIN`, and `ADMIN_EMAIL` for this account (all optional —
   see `sample-deploy.conf` for defaults). `deploy.conf` is untracked/gitignored,
   since it's specific to this one clone.
3. Trigger a deploy (cPanel's **Manage** → **Update from Remote** then
   **Deploy HEAD Commit**, or push to `main` and pull from cPanel).

`src/_data/site.js` defaults `site.url` to `https://dermotcochran.com/`;
`scripts/cpanel-deploy.sh` overrides it via `SITE_DOMAIN` (from `deploy.conf`'s
`DOMAIN`) at deploy time, and it can also be set directly as an env var for
other builds/previews.

### PR previews

`.github/workflows/pr-preview.yml` builds each pull request and publishes it
to GitHub Pages via [`rossjrw/pr-preview-action`](https://github.com/rossjrw/pr-preview-action),
posting the preview URL as a PR comment; closing the PR tears the preview
down again. This is a review aid only — production still deploys exclusively
through cPanel above, and GitHub Pages is not otherwise used to serve this
site.

One-time setup: in **Settings → Pages**, set **Source** to **Deploy from a
branch** and pick the `gh-pages` branch (the action creates it on the first
PR after this is enabled).

## Comments

Photo/gallery pages can show a [giscus](https://giscus.app/) discussion thread,
backed by this repository's own GitHub Discussions. `src/_data/giscus.js`
already has the repo and repo ID filled in; `GISCUS_CATEGORY_ID` still needs to
be set (as a repository variable, or in a local `.env`) before comments will
render — run the generator at https://giscus.app/ against this repo to get it.

## License

- **Code** (everything except the photographs): MIT — see `LICENSE`.
- **Photographs** (`src/photos/`, `src/images/photos/`): © Dermot R. Cochran,
  licensed under [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/)
  — see `LICENSE-PHOTOS.md`. Sharing with attribution is welcome; commercial
  use and derivative works are not permitted without separate permission.
