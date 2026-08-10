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

### Categories

Each photo is filed under a single `category`. The set in use:

- **Macro** — close-up detail of a small subject.
- **Wildlife** — animals and birds.
- **Landscape** — wide natural or outdoor scenes.
- **Architecture** — buildings and built structures.
- **Nature** — any natural image that is not clearly Wildlife, Macro, or
  Landscape. Defined as a residual bucket so it never overlaps with those
  three.

A category with no photos generates no `/category/<slug>/` page, so `Nature`
only appears once a photo is filed under it.

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
logs in the untracked `deploy-logs/`. That log/notification machinery lives in
`scripts/deploy-lib.sh`, kept byte-identical with the same file in the
`star-rangers` repository (like `scripts/ensure-node.sh`) — change it in one
repo, copy it verbatim to the other.

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
4. Install the cron job below, so step 3 stops being a manual step.

`src/_data/site.js` defaults `site.url` to `https://dermotcochran.com/`;
`scripts/cpanel-deploy.sh` overrides it via `SITE_DOMAIN` (from `deploy.conf`'s
`DOMAIN`) at deploy time, and it can also be set directly as an env var for
other builds/previews.

### Automatic deployment from cron

**Merging to `main` does not update dermotcochran.com by itself.** Nothing
connects the two: cPanel does not poll GitHub, and GitHub cannot push into
cPanel. A merge updates the *remote* and not the cPanel *checkout*, so until
something on the server pulls, the merge is real, CI is green, and the live
site is still the previous build. Step 3 above is that pull, done by hand.

[`scripts/cpanel-autopull.sh`](./scripts/cpanel-autopull.sh) automates it. It
fast-forwards the checkout and, only when that moves the commit this clone has
*successfully deployed*, hands off to `scripts/cpanel-deploy.sh`. Like
`deploy-lib.sh` and `ensure-node.sh` it is kept **byte-identical** with the
copy in the `star-rangers` repository — change it in one repo and copy it
verbatim to the other.

> **Forking wouldn't have solved this.** A GitHub fork does not auto-sync from
> upstream either — "Sync fork" is a manual button, or a scripted
> `gh repo sync` — and a cPanel clone pulls from whatever URL it was given
> without subscribing to anything at either end. Setting the cPanel repository
> up as a fork would have added a hop needing its own trigger, not removed one.

#### Install

One crontab line, in cPanel → **Advanced** → **Cron Jobs** on the account
holding the clone:

```bash
*/10 * * * * /bin/bash "$HOME/<checkout-dir>/scripts/cpanel-autopull.sh"
```

`<checkout-dir>` is the *Repository Path* cPanel's Git Version Control shows
for the clone — not necessarily the repo name. If an account also holds a
`star-rangers` clone, that needs its own separate line.

Ten minutes is a starting point. The script exits in well under a second when
there is nothing new, so a shorter interval costs almost nothing; a longer one
just means the site lags further behind a merge.

#### What it does and doesn't do

- **Silent when idle.** Cron mails any output a job produces, so it prints
  nothing unless it deploys or fails. Add `--verbose` to a manual run to see
  every decision.
- **Deploys only on a real change.** It compares HEAD against the last commit
  it deployed *successfully*, recorded under `$HOME/.cpanel-autopull/`.
  Comparing HEAD before and after the pull would be the obvious test and is
  wrong: if a pull succeeds and the deploy after it fails, HEAD is already
  advanced, so the next run would see "nothing new" and never retry — leaving
  the site stale behind a cron job that looks healthy. Tracking last-*deployed*
  means a failed deploy is retried every run until it succeeds.
- **`--force`** deploys regardless — use it after editing `deploy.conf`, which
  is untracked and so never moves HEAD, but does change what gets built.
- **`--status`** prints the branch, HEAD, last-deployed commit and lock state,
  and changes nothing.
- **Locks**, so two runs can't rsync `public_html/` at once when a deploy
  outlasts the cron interval. A lock whose owning process is gone is reclaimed
  rather than blocking forever.
- **`--ff-only`, deliberately.** A deployment checkout is never a place work is
  done, so anything that can't fast-forward is a fault to report, not a merge
  to resolve. A modified *tracked* file is the usual cause; `deploy.conf` is
  untracked and gitignored, so it never interferes.
- **No logging of its own on top of the deploy's.** `scripts/cpanel-deploy.sh`
  already emails its full log to `ADMIN_EMAIL` and keeps 20 runs in
  `deploy-logs/`. This script keeps only a small pull/skip/deploy decision log
  at `$HOME/.cpanel-autopull/<clone>.log`, pruned to the last 500 lines.

Exit codes: `0` nothing to do or deployed, `1` unusable environment, `2`
another run holds the lock, `3` the pull failed, anything else is
`cpanel-deploy.sh`'s own status.

#### Verifying an install

Run it by hand once from SSH before trusting cron:

```bash
bash "$HOME/<checkout-dir>/scripts/cpanel-autopull.sh" --status
```

That touches nothing. Then `--verbose --force` once to confirm a real deploy
works end to end from this path, and check the site. After that, cron's
silence is the success signal.

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
