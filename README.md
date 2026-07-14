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

The site is hosted at [dermotcochran.com](https://dermotcochran.com) via cPanel.
A GitHub Actions workflow (`.github/workflows/cpanel-deploy.yml`) builds the
site with Eleventy on every push to `main` and uploads `_site/` to the
account's `public_html/` over FTPS. Before it can succeed, add these
repository secrets (Settings → Secrets and variables → Actions):

- `FTP_SERVER` — the cPanel account's FTP/FTPS hostname
- `FTP_USERNAME` — the cPanel FTP username
- `FTP_PASSWORD` — the cPanel FTP password

`src/_data/site.js` defaults `site.url` to `https://dermotcochran.com/`;
override it with a `SITE_DOMAIN` env var for other builds/previews.

## Comments

Photo/gallery pages can show a [giscus](https://giscus.app/) discussion thread,
backed by this repository's own GitHub Discussions. `src/_data/giscus.js`
already has the repo and repo ID filled in; `GISCUS_CATEGORY_ID` still needs to
be set (as a repository variable, or in a local `.env`) before comments will
render — run the generator at https://giscus.app/ against this repo to get it.

## License

MIT — see `LICENSE`.
