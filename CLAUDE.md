# dermot-cochran-photography

Dermot Cochran's photography portfolio. Eleventy static site published to
dermotcochran.com. PRs get a GitHub Pages preview
(`.github/workflows/pr-preview.yml`).

**Deployment is manual, and nothing in CI publishes to the live site.**
Merging to `main` makes a change *ready to deploy*, not live. Dermot publishes
from cPanel's Git Version Control page — **Update from Remote** to pull, then
**Deploy HEAD Commit**, which runs `.cpanel.yml` → `scripts/cpanel-deploy.sh`
(Node, `npm ci`, Eleventy build, rsync to `public_html/`, verification, and a
deploy-log email either way). See README.md's Deployment section.

So **never report a merged photograph as published.** Say it is merged and
awaiting a deploy, and say how many changes are queued if more than one. A
GitHub Actions FTP deploy was considered and deliberately rejected in July
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

**The two buckets are deliberately asymmetric**, because a missing `IPF-Nature`
doesn't mean one thing:

- **Wild** — Macro, Nature *or* Wildlife carrying `IPF-Nature`.
- **Cultivated** — Macro or Nature *without* it: planted, tended, ornamental.
- **Neither** — Wildlife without it means captive, feral, or a human element in
  frame, none of which is "cultivated". Those photos don't appear in this
  browse at all, and get no Subject row. Filing a lion under Cultivated would
  be nonsense.

Other categories are skipped; the question is meaningless for architecture.
**Tagging competitions correctly keeps this browse correct** — a wrong tag now
shows up in two places, which is a feature.

## Category rules

Categories in use: Wildlife, Landscape, Architecture, Nature, Macro,
Documentary, Creative.

- Pure wildlife (no human element) → **Wildlife**
- Not pure wildlife → **Nature** or **Documentary**
- Any "hand of man" in a wildlife/nature scene (vehicles, people, balloons,
  buildings) → **Documentary**
- Abstract images, composites, multiple exposures, and other creative
  treatments → **Creative**
- Photos *of* other people (photographers in action, visitors with animals)
  are good Documentary material — but group photos that include Dermot were
  taken by someone else and must not go on the site.

## Competition eligibility tagging

Every photo's front matter carries a `competitions:` list. Evaluate each new
photo against both rulesets when adding it:

- **DCC** (Dublin Camera Club, dublincameraclub.ie full competition rules):
  any subject, must be wholly Dermot's own work; composites allowed if every
  component is his. Effectively every site photo qualifies. Digital spec:
  JPEG sRGB, max 3840×2160 px, max 3 MB.
- **WNPA** (World Nature Photography Awards): nature subjects only; **no
  captive or restrained animals** (Giraffe Centre shots are out), **no
  composites** or object addition/removal, no baiting. People are fine in
  the "People and nature" / "Urban wildlife" categories, so Documentary
  safari shots can qualify; pure architecture and built environments do not.
  Spec: JPEG, longest side 1000–3000 px, max 3 MB, EXIF intact, no name in
  metadata.
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
