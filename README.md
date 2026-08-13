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
`star-rangers` repository (like `scripts/mail-lib.sh` and
`scripts/ensure-node.sh`) — change it in one repo, copy it verbatim to the
other. The mail transport itself sits one level down in `scripts/mail-lib.sh`,
so `cpanel-autopull.sh` can reach `ADMIN_EMAIL` for its own failures — the
ones that happen before `deploy-lib.sh` is ever sourced — without a second
copy of the same `mail(1)`/`sendmail` fallback.

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
`deploy-lib.sh`, `mail-lib.sh` and `ensure-node.sh` it is kept
**byte-identical** with the copy in the `star-rangers` repository — change it
in one repo and copy it verbatim to the other. (It was *not* identical until
13 August 2026: one copy's comment said "README" and the other's said
"TECHNICAL-README.md", which is precisely how two files that must match come
apart. Nothing in it may name one repo's own filenames.)

> **Forking wouldn't have solved this.** A GitHub fork does not auto-sync from
> upstream either — "Sync fork" is a manual button, or a scripted
> `gh repo sync` — and a cPanel clone pulls from whatever URL it was given
> without subscribing to anything at either end. Setting the cPanel repository
> up as a fork would have added a hop needing its own trigger, not removed one.

#### Install

One crontab line, in cPanel → **Advanced** → **Cron Jobs** on the account
holding the clone:

```bash
*/10 * * * * /bin/bash "$HOME/repositories/dermot-cochran-photography/scripts/cpanel-autopull.sh"
```

cPanel's Cron Jobs form takes the schedule in its own fields, so the
**command** box gets only the `/bin/bash "…"` part.

The account keeps its Git Version Control checkout under `~/repositories/`.
Confirm the last path segment against the **Repository Path** cPanel shows for
the clone — it isn't always the repo name. If the account also holds a
`star-rangers` clone, that needs its own separate line.

**Use `$HOME` rather than a hardcoded `/home/<user>/`.** cron sets `HOME` from
the account's `/etc/passwd` entry and runs the command through `sh`, so it
expands correctly — and it means the *same line* works on any account holding
a clone, with nothing to hand-edit. Keep the double quotes; single quotes
would stop the expansion. (This is a different question from `deploy.conf`'s
`CPANEL_USER`, which names the deploy *destination* rather than where the
script lives.)

A wrong path announces itself on the first run rather than failing quietly:
bash exits with `No such file or directory`, cron mails it, and nothing
deploys.

##### Don't prefix it with a pull

The natural instinct is to write the crontab line as the familiar one-liner
plus the script:

```bash
# WRONG - do not do this
cd ~/repositories/dermot-cochran-photography && git pull --ff-only && bash scripts/cpanel-autopull.sh
```

That reintroduces the exact fault the script exists to prevent. **The bare
`git pull` runs outside the lock.** A full deploy — `npm ci` plus the Eleventy
build — can outlast a ten-minute interval, so runs overlap; when they do, that
unlocked pull advances HEAD while a build is already reading the tree, and the
build ships a mixture of two commits. The script's own pull happens *inside*
the lock, which is the whole reason it's there.

Two lesser problems with the chained form: `cd` is redundant (the script
resolves its own checkout from its own location, deliberately, because cron
runs from `$HOME`), and the `&&` chain swallows the script's exit codes — a
transient network failure during the leading `git pull` breaks the chain, so
you get raw git noise instead of a clean exit 3 and a decision-log line, and
the script never runs at all.

The unguarded form without the script is different but also wrong for a
schedule:

```bash
cd ~/repositories/dermot-cochran-photography && git pull --ff-only && bash scripts/cpanel-deploy.sh
```

That works when typed by hand, which is where it comes from. On a timer it
rebuilds and re-rsyncs on **every** run whether anything changed or not, and
emails a deploy log each time. `cpanel-autopull.sh` is that same sequence plus
the guards below.

Ten minutes is a starting point. The script exits in well under a second when
there is nothing new, so a shorter interval costs almost nothing; a longer one
just means the site lags further behind a merge.

#### What it does and doesn't do

- **Silent when idle, and loud when it fails.** Cron mails any output a job
  produces, so the script prints nothing unless it deploys or fails. Add
  `--verbose` to a manual run to see every decision.

  Silence used to be ambiguous, which was a real problem: a run that did
  nothing and a run that *failed* looked identical from a mailbox, because
  `err()` writes to stderr and cron delivers stderr to the account's own
  system mailbox — not to `ADMIN_EMAIL`, and not anywhere anyone reads.
  Deploy outcomes were always mailed properly; the blind spot was the window
  before the handoff. Since 13 August 2026 a run that fires and fails mails
  `ADMIN_EMAIL` directly, so silence means one thing only: nothing needed
  doing.

  | outcome | mailed? |
  | --- | --- |
  | exit 0, nothing to do | no — this is the point |
  | exit 1, unusable environment | **yes** |
  | exit 2, another run holds the lock | no — a long deploy is normal, not a fault |
  | exit 3, pull failed | **yes** |
  | the deploy itself failed | **yes**, by `cpanel-deploy.sh` as it always has |

  Exit 2 is deliberately quiet. Mailing a lock that a long deploy is legitimately
  holding would train the alert to be ignored, which is the exact failure this
  change exists to prevent.
- **Knows when it last ran, not just what it last deployed.** Every run stamps
  `$HOME/.cpanel-autopull/<clone>.lastrun`, including runs that find nothing and
  runs that exit on a held lock — the question "is cron still firing?" is
  different from "what is deployed?", and only the first tells you the schedule
  itself has stopped. `--status` prints both.

  Setting `AUTOPULL_MAX_GAP_HOURS` in `deploy.conf` mails an alert when the
  previous run was longer ago than that. It is unset by default and stays that
  way unless you choose a number: the interval lives in cPanel → Cron Jobs, not
  in this repo, so the repo has no basis for guessing one. **It can only report
  a gap on the next run that actually happens** — a cron that stops firing
  altogether cannot report its own absence, and no code here can change that.
- **Deploys only on a real change.** It compares HEAD against the last commit
  it deployed *successfully*, recorded under `$HOME/.cpanel-autopull/`.
  Comparing HEAD before and after the pull would be the obvious test and is
  wrong: if a pull succeeds and the deploy after it fails, HEAD is already
  advanced, so the next run would see "nothing new" and never retry — leaving
  the site stale behind a cron job that looks healthy. Tracking last-*deployed*
  means a failed deploy is retried every run until it succeeds.
- **`--force`** deploys regardless — use it after editing `deploy.conf`, which
  is untracked and so never moves HEAD, but does change what gets built.
- **`--status`** prints the branch, HEAD, last-deployed commit, when it last
  ran (and how long ago), the resolved notification address, the gap threshold
  and the lock state — and changes nothing.
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
`cpanel-deploy.sh`'s own status. A failed send never changes any of them — a
fault that couldn't be emailed is still that fault, with its own code.

#### Verifying an install

Run it by hand once from SSH before trusting cron:

```bash
bash "$HOME/repositories/dermot-cochran-photography/scripts/cpanel-autopull.sh" --status
```

That touches nothing. Then `--verbose --force` once to confirm a real deploy
works end to end from this path, and check the site. After that, cron's
silence is the success signal.

#### Checking what's live

Every deploy stamps what it shipped — `git describe --tags --always --dirty`.
This repo carries no release tags, so that reads as the short commit (e.g.
`205c9f8`), which is all the identity it has; `--dirty` marks a checkout with
modified *tracked* files, so the untracked `deploy.conf` never trips it.

It lands in three places:

- **The deploy email subject**, so the notification you already receive says
  what it shipped.
- **[`/version.txt`](https://dermotcochran.com/version.txt)**, which is the one
  check that tests the whole chain rather than one link in it:

  ```bash
  curl -s https://dermotcochran.com/version.txt
  ```

- **`<meta name="site-version">`** in every page's `<head>`, for when you're
  already looking at the page.

A green cron job only proves the script ran — not that the build succeeded or
that the rsync landed. Curling `/version.txt` and comparing it against
`git rev-parse --short HEAD` on `main` is the whole check:

```bash
curl -s https://dermotcochran.com/version.txt | head -1   # version: 205c9f8
git rev-parse --short HEAD                                # 205c9f8
```

`version: dev` means that build did not come through the cPanel deploy path at
all — a local build, or a GitHub Pages PR preview. On the production domain
that is itself the finding.

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
