# Testing Strategy

How this repository is tested, what each check exists to catch, and how to
extend it. Editorial rules the checks enforce live in `CLAUDE.md`; taste lives
in `STYLE.md` and is deliberately not checkable.

## The governing principle

The build proving the templates render is a different question from the front
matter being *right*, and most of what can go wrong here is front matter: a
typo'd tag or a colliding `order` produces a site that builds green and quietly
misfiles a photograph. So the strategy is: **fail on what is always wrong, warn
on what is a judgement not yet made, and leave judgement itself to Dermot.**

The line between fail and warn is exact. A `setting:` value outside
Natural/Altered/Built is always wrong (worse: `naturalOrBuilt` nulls it, so the
typo reads back as a deliberate absence) and fails. A Landscape/Documentary/
Creative photo with *no* `setting:` is a judgement not yet made — staying off
`/natural-or-built/` is the documented deliberate behaviour — so it warns,
every run, until the judgement is recorded.

## Layer 1 — `scripts/validate-photos.js` (in `npm test`)

Fails on:

- a missing required field (`layout`, `title`, `category`, `location`, `year`,
  `album`, `image`, `alt`, `order` — and `competitions:`, which must be present
  even as `[]`, because "eligible for nothing" is itself an evaluation and an
  absent key is indistinguishable from a photo nobody assessed)
- a `category` outside the eight in use, or a `competitions:` tag outside
  DCC / WNPA / IPF-Nature / IPF-Wildlife — a typo'd `IPF-Nature` silently
  misfiles a plant on `/wild-or-cultivated/` and `/natural-or-built/`
- an invalid `setting:` value (see above)
- an `image:` that doesn't exist, is shared by two photos (the no-duplicates
  rule: publish the combination or the best single frame, never both), or is
  not a `.jpg` — the pipeline is only verified for JPEG; before the first GIF,
  verify passthrough and `photo.njk` carry it, then widen the check in the same
  change (CLAUDE.md's GIF note)
- an image on disk that no photo references — either a forgotten `.md` (the
  photo silently isn't on the site) or a rename leftover
- a duplicate `order` — the homepage picks "newest" by order, so a collision
  makes that pick arbitrary
- a `featured:` that is neither `true` nor a positive integer — the slideshow
  treats any truthy value as featured but only a *number* as a fixed
  position, so a quoted `"1"` silently becomes an unranked slide, and `0` or
  `false`, being falsy, silently behave as unflagged (not-featured = omit the
  key); and a numeric featured *position* claimed twice, which makes the
  slide order arbitrary the same way a duplicate `order` does. More than 10
  featured photos only **warns**: the cap dropping the back of the sequence
  is documented behaviour, so it is surfaced, not enforced.

It parses front matter with `gray-matter`, the same parser Eleventy uses, so
what validates is exactly what the build sees (BOM-prefixed files included).
The category and competition vocabularies live at the top of the script; a new
category is added there **in the same change** that introduces it.

## Layer 1a — unit tests (`test/derivations.test.js`, in `npm test`)

The derived facets and the homepage slideshow selection live in
`lib/derivations.js` (extracted verbatim from `.eleventy.js` on 2026-08-27,
mirroring `star-rangers`' `lib/classify-content.js` move) so they can be
tested without booting Eleventy — `.eleventy.js` remains the only production
consumer. `node --test test/*.test.js` runs first in `npm test`: built-in
`node:test`, no new dependencies. The suite pins `countryOf` (comma parsing,
`AT_SEA_LOCATIONS`), `wildOrCultivated` (category decides animals, the
IPF-Nature tag decides plants, everything else out of scope),
`naturalOrBuilt` (explicit `setting:` precedence, category defaults, the
deliberate null), `slugify` (the Scandinavian letter map and NFD accent
stripping), `groupPhotosBy`, and `selectHomepagePhotos` (featured ordering,
one slide per album, the cap of 10, pure recency when nothing is flagged) —
CLAUDE.md's worked examples as executable fixtures.

## Layer 2 — build and CI

- `eleventy --dryrun` (the rest of `npm test`): template errors.
- CI (`.github/workflows/ci.yml`): `npm test`, ShellCheck
  (`--severity=warning`) over the five deploy scripts, and the
  **shared-scripts job** — `deploy-lib.sh`, `mail-lib.sh`, `ensure-node.sh`
  and `cpanel-autopull.sh` are byte-identical twins of `star-rangers`' copies,
  and the job diffs them against that repo's `main`: pre-existing drift fails,
  a PR that is itself changing a shared script warns only (the identical edit
  lands in the sibling as its own PR, and one of the two has to merge first).
  Its first run caught real drift: this repo carried a pre-15-August
  `cpanel-autopull.sh` for nine days.
- `pr-preview.yml`: a GitHub Pages preview per PR — the human check for what
  no validator can see. Wait for all three CI checks before merging.

## What CI cannot verify: deployment

Deployment is a cPanel cron pulling `main` overnight, not CI. A green merge
means **merged and due to deploy overnight** — say **live** only once
`curl -s https://dermotcochran.com/version.txt` shows a commit at or past the
merge, and quote what you saw. `version: dev` means the build did not come
through the cPanel path at all. (Full detail in `CLAUDE.md` and README.)

## Deliberately not automated

- **Looking at the actual image.** Recognisable people, background buildings a
  competition tag forgot, a subject that fails to read at page size — the
  standing rules all end in "check the frame, not the title", and no script
  does that.
- **Category and setting judgements** — the checks enforce the vocabulary, not
  the choice.

## Known gaps (candidates for next)

- The five photos currently warned on for missing `setting:`
  (`at-the-field-edge`, `bench-under-the-turning-tree`,
  `blossom-tree-at-farmleigh`, `sheep-and-alpaca`, `the-easel-on-the-lawn`)
  stay warned until the judgements are made.
