# dermot-cochran-photography

Dermot Cochran's photography portfolio. Eleventy static site published to
dermotcochran.com. PRs get a GitHub Pages preview
(`.github/workflows/pr-preview.yml`).

**Deployment is automatic, but it is not CI, and it is not immediate.** A cron
job on the cPanel account runs `scripts/cpanel-autopull.sh`, which
fast-forwards the server's checkout and — only when that moves it past the
commit this clone last *successfully* deployed — hands off to
`scripts/cpanel-deploy.sh` (Node, `npm ci`, Eleventy build, rsync to
`public_html/`, verification, and a deploy-log email either way). Nothing in
GitHub Actions publishes: CI only builds, lints and previews.

**Mind the interval.** README.md documents the crontab line as
`*/10 * * * *`, but that is the worked example, not the install. **Dermot's
actual cron runs once a day, overnight**, so a merge typically publishes the
following morning rather than within minutes. The schedule lives in cPanel →
Cron Jobs on the account, not in this repo, so the repo cannot tell you what it
is — don't infer the interval from the README.

*This section described a wholly manual cPanel process until 12 August 2026.
The cron landed on 10 August (PRs #74–#76) and this file was not updated with
it, while README.md was.*

**A failed autopull now emails you** (13 August 2026). It used to write to
stderr, which cron delivers to the cPanel account's own system mailbox rather
than to `ADMIN_EMAIL` — so a run that failed and a run with nothing to do both
arrived as silence. A run that fires and *fails* (exit 1, or exit 3 when the
pull can't fast-forward) now mails `ADMIN_EMAIL` directly. Silence therefore
means "nothing needed doing", and only that. Two limits worth keeping in mind:
a held lock (exit 2) stays deliberately quiet because a long deploy holding it
is normal, and **a cron that stops firing entirely still reports nothing** —
nothing runs to complain. `--status` now prints when it last ran, which is the
question that answers.

**Confirm rather than assume, in both directions.** A green cron run only
proves the script ran. `curl -s https://dermotcochran.com/version.txt` returns
the `git describe` of the build actually being served — that is the check that
a merge really landed, and `version: dev` means the build did not come through
the cPanel deploy path at all. So: say a photograph is **merged and due to
deploy overnight**; say it is **live** only once `/version.txt` shows a commit
at or past it, and quote what you saw.

A GitHub Actions FTP deploy was considered and deliberately rejected in July
2026: it needs `FTP_*` credentials stored against a public repo, and an FTP
password for the cPanel account is a key to the whole hosting account. cPanel
pulling from a public repo needs no credentials at all, which is why this is
the safer arrangement. Don't propose the Actions route again.

## Adding a photo

1. Create `src/photos/<slug>.md`:

   ```yaml
   ---
   layout: photo.njk
   title: "Leopard in Morning Light"
   category: "Wildlife"          # see category rules below
   location: "Maasai Mara, Kenya"
   year: 2025                    # from EXIF DateTimeOriginal, not file mtime
   album: "Maasai Mara, October 2025"
   image: "leopard-in-morning-light.jpg"
   alt: "A leopard resting in dew-covered grass, lit by low sunrise light"
   order: 34                     # next integer after the current highest
   ---
   ```

2. Place the image at `src/images/photos/<slug>.jpg`.

That's all — category/location/year/album archive pages are generated
automatically from front matter. No template changes needed, even for a
brand-new category, location, or album.

**Country is derived, not written.** There is no `country:` field. `.eleventy.js`
takes the last comma-separated segment of `location`, so "Enkewa, Maasai Mara,
Kenya" and "Maasai Mara, Kenya" both roll up under Kenya, and `/country/` pages
stay correct with nothing extra to maintain. A location with no comma is treated
as a country in its own right. Open water is the one case that can't be parsed —
add it to `AT_SEA_LOCATIONS` in `.eleventy.js` and it groups under "At sea"
(currently just "Baltic Sea").

**Wild vs cultivated is derived too.** No field for it either.
`/wild-or-cultivated/` reads `competitions:` — `IPF-Nature` bans cultivated
plants and ornamental gardens outright, so the tag *is* the wild marker.

**It is a strict binary — every photo in scope is Wild or Cultivated, never
both and never in between.** That needs a different signal for animals than for
plants, because `IPF-Nature` is a *compound* test: wild AND no human element
AND not cultivated AND not feral.

- **Wildlife → always Wild.** Decided by category, not by tag. For animals the
  tag usually fails on a vehicle track or a building in shot, which says
  nothing about whether the animal is wild — *Young Lion in Morning Light* is a
  wild lion lying on a bare earth track. The category is the authored judgement
  about what the subject is (pure wildlife → Wildlife, hand of man →
  Documentary), so a Wildlife photo is a wild subject by definition.
- **Macro and Nature → `IPF-Nature` decides.** For plants the only realistic
  way to fail that tag is cultivation, so it is an exact marker.
- **Everything else is out of scope** and gets no Subject row; the question is
  meaningless for architecture.

So getting a *category* wrong misplaces an animal, and getting a *competitions*
tag wrong misplaces a plant. Both now show up in two places, which is a
feature.

## Category rules

Categories in use: Wildlife, Urban Wildlife, Landscape, Architecture, Nature,
Macro, Documentary, Creative.

- Pure wildlife (no human element) → **Wildlife**
- **Free-living animals in a built or urban setting → Urban Wildlife.** Added
  July 2026 to close a gap: the old rules forced a false choice for these, since
  `Wildlife` ignored the buildings and `Documentary` ignored that they are
  wildlife pictures. The animal must be free — not captive, not a pet. Feral
  counts; a hyrax in a museum coffee machine chose that machine. This aligns
  with WNPA's own Urban Wildlife section, so these are worth checking for that
  entry rather than assuming DCC-only.
- Not pure wildlife → **Nature** or **Documentary**
- Any other "hand of man" in a wildlife/nature scene (vehicles, people,
  balloons) → **Documentary**
- Abstract images, composites, multiple exposures, and other creative
  treatments → **Creative**
- Photos *of* other people (photographers in action, visitors with animals)
  are good Documentary material — but group photos that include Dermot were
  taken by someone else and must not go on the site.

## People in photographs

**No recognisable person goes on the site** (standing instruction, 12 August
2026). If a frame contains one, it is deleted, blurred or cropped — those are
the three options, and cropping is usually the honest one because it changes
nothing about the pixels that remain.

- **Recognisable** means a viewer could identify the individual: face legible,
  or distinctive enough in build, dress and context to be picked out. It is
  about identifiability, not about whether Dermot knows them.
- **Distant and anonymous figures are fine** and always have been — silhouettes
  against a sunrise, strangers a hundred metres off, a walker ten pixels tall at
  the end of a path. `poolbeg-watchers-at-sunrise` is published on exactly this
  basis.
- **Family and friends are never published at all**, recognisable or not. This
  is a category rule and not a permission question: don't propose asking them.
- **Check the frame, not the title.** People hide at the far end of paths, in
  reflections, and on distant benches. Look at the actual image at full size
  before tagging or publishing — the same discipline the competition tags need.

## Competition eligibility tagging

Every photo's front matter carries a `competitions:` list. Evaluate each new
photo against both rulesets when adding it:

- **DCC** (Dublin Camera Club, dublincameraclub.ie full competition rules):
  any subject, must be wholly Dermot's own work; composites allowed if every
  component is his. Effectively every site photo qualifies. Digital spec:
  JPEG sRGB, max 3840×2160 px, max 3 MB.
- **WNPA** (World Nature Photography Awards): nature subjects only; **no
  captive or restrained animals** (Giraffe Centre shots are out), **no
  composites** or object addition/removal, no baiting. Spec: JPEG, longest
  side 1000–3000 px, max 3 MB, EXIF intact, no name in metadata. Deadline is
  **30 June** (midnight GMT).
  **14 categories**, checked against the published rules 28 July 2026:
  Animals in their habitat; Animal portraits; Behaviour — Amphibians and
  reptiles / Birds / Invertebrates / Mammals; Plants and fungi; **Urban
  wildlife**; Planet Earth's landscapes and environments; Underwater; Black
  and white; Nature art; Nature photojournalism; People and nature.
  **The rules do not ban built environments, man-made structures, feral
  animals, or cultivated plants** — an earlier note here claimed they ruled
  out built environments, and that isn't in the text. "Not captive or
  restrained" is the only animal restriction. So Urban Wildlife photos
  qualify via that category, and garden plants qualify under Plants and
  fungi. Don't under-claim WNPA on either.
- **IPF-Nature / IPF-Wildlife** (Irish Photographic Federation; FIAP
  definitions — DCC also uses these for its own Nature competitions):
  **strictest** ruleset. No human elements at all (vehicles, vehicle tracks,
  buildings, balloons, boats all disqualify), no cultivated plants or
  ornamental gardens, no feral/domestic animals, no composites; dust-spot
  removal and crops are fine. **IPF-Wildlife** additionally requires
  zoological subjects living wild and free — captive animals can appear in
  Nature sections at some events but never Wildlife. Landscapes and geology
  qualify for Nature only. IPF national digital spec: 1600 px long edge —
  the site images already comply, no separate master needed.

Tag as `competitions: [DCC, WNPA, IPF-Nature, IPF-Wildlife]` down to `[DCC]`
— if a photo is eligible for nothing, leave the list empty and the 1600 px
site version is all that's needed. Look at the actual image before tagging:
background buildings, tracks, or a cruise-ship deck are easy to forget from
the title alone (Sunset at Sea is DCC-only for exactly that reason).

## Competition masters

Photos eligible for either competition get a high-res master in
`F:\Competition Masters\<year>\` (CamelCase title names): 3240×2160 (fit
within DCC's 3840×2160), quality ~92, ≤3 MB, EXIF kept. Downsize to 3000 px
long edge at submission time for WNPA. `README.txt` there carries the full
eligibility manifest and rules summaries. Files still at 1600 px are
placeholders whose originals haven't been located yet. Only the best ≤24
photos per year are needed.

## Image conventions

- Landscape orientation: 1600 px long edge (1600×1067 for 3:2)
- Portrait orientation: 1200×1600
- JPEG, sRGB, roughly 250–550 KB. Minimalist frames (silhouettes, plain skies)
  land well under that at quality 88 — that's fine, don't inflate quality.
- Photos are heavily HDR/vivid-processed in camera (Nikon) — preserve the
  punchy look; downscaling from full-res source tames sky noise.
- Use `sharp` (Node). No ImageMagick/Python on this machine.

## Verifying and shipping

- Build locally with `npm run build`; check the new pages exist under `_site/`
  and that every `images/photos/*.jpg` reference resolves.
- `gh` is not installed — open PRs via the GitHub REST API using the token
  from `git credential fill`. CI runs ShellCheck, an Eleventy dry run, and a
  PR preview deploy; wait for all three before merging.

Dermot's DCC submission workflow folders (`Ready for Submission`,
`Submitted Images`) are in `...\OneDrive\Pictures\DCC\`; he submits via
Pixoroo.

## Source material

Raw camera dumps (JPG + NEF) live in `F:\<NNNXXXXX>\` folders (e.g.
`F:\103KENYA`). Staging folder for one-off photos to process:
`C:\Users\Harvey Norman\Dermot Cochran\OneDrive\Pictures\CLAUDE\`.
Get `year` from EXIF DateTimeOriginal. When choosing from a burst, compare
frames visually — Laplacian sharpness scores track grass texture, not focus.
