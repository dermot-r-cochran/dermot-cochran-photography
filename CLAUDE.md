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

**Creative direction lives in [`STYLE.md`](./STYLE.md)**, not here — the
enigmatic/withholding treatment, what to crop away, the darkroom pass, and the
frame-withholds/note-supplies pairing. This file holds mechanical conventions,
which are checkable; that one holds taste, which is not.

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

**`featured: true` (optional) reserves a homepage slide.** The slideshow is
normally the newest photo from each of the 10 most recently added-to albums —
a recency sampler, not a best-of. A featured photo takes a slot ahead of that
and leads the rotation, and within its album it represents the album instead
of the newest photo. One slide per album still holds (two featured photos in
one album: the higher `order` wins), and the cap is still 10, so flagging more
than 10 drops the lowest-`order` featured ones. Unflagged behaviour is
unchanged — with no `featured:` anywhere, the slideshow is pure recency.

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
- **Macro is the exception, not the default** (Dermot's rule, 15 August 2026).
  Prefer **Nature** for plants and natural subjects; reach for **Macro** only
  when the frame is *very* close up and the subject genuinely enlarged.
  Magnification is the test, and it is worth **measuring rather than
  eyeballing** — reproduction ratio is `sensor width / (subject size in life ×
  frame width in px / subject width in px)`, with the D3100 at 23.6 mm and
  4608 px. The Bohernabreena close-ups of 15 August looked like macro work and
  measured 1:7 to 1:11, so all of them are Nature. True macro is 1:1 and even
  conventional close-up work starts near 1:4.
  This boundary went unwritten until now, which is why
  `amber-rose-in-dappled-light` (Macro) and `clematis-seedheads` (Nature) sit
  in different categories at the same magnification. Re-filing the clematis is
  a separate decision and has **not** been made.
  Note the category is the *only* choice here: Wild vs Cultivated is derived
  from the `IPF-Nature` tag and cannot be set directly.
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

## Mating and other explicit animal behaviour

**Don't publish the act** (Dermot's instruction, 14 August 2026). Where a
sequence covers mating, publish the pair *before or after* — resting together,
standing, the companionable frames — and leave the copulation itself in the
folder. His reason: some viewers, women especially, are uncomfortable being
shown it, and a portfolio should not put that in front of them unasked.

This is a presentation rule, not a squeamishness about natural history. The
behaviour can still be *written about* in the note — the Amboseli pair on the
pan (*The Pair*, `123KENYA` `DSC_8751`) carries a line explaining that a
courting pair leaves the pride for several days, which is why two lions are
alone out there. Say it in words, don't show it.

The frames themselves stay on `F:` — nothing is deleted, and `DSC_8764` is the
clearest of that mount sequence if it is ever wanted for another purpose.

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
  removal and crops are fine.
  **Two exceptions to "no human elements", straight from the definition in
  force** (FIAP INFO 313/2025, agreed with PSA — checked 14 August 2026 against
  `F:\CLAUDE\FIAP Nature Rules 2025.pdf`): a human element is allowed *"when
  they are a small but unavoidable part of the scene, such as an unobtrusive
  footprint or track in the background"*, and **"scientific tags, collars, and
  bands are specifically allowed"**. So a ringed bird is not disqualified —
  `irelands-eye-herring-gull-calling` carries a blue numbered leg ring and is
  tagged for both IPF sections. Don't under-claim on a ring. **IPF-Wildlife** additionally requires
  zoological subjects living wild and free — captive animals can appear in
  Nature sections at some events but never Wildlife. Landscapes and geology
  qualify for Nature only. IPF national digital spec: 1600 px long edge —
  the site images already comply, no separate master needed.

Tag as `competitions: [DCC, WNPA, IPF-Nature, IPF-Wildlife]` down to `[DCC]`
— if a photo is eligible for nothing, leave the list empty and the 1600 px
site version is all that's needed. Look at the actual image before tagging:
background buildings, tracks, or a cruise-ship deck are easy to forget from
the title alone (Sunset at Sea is DCC-only for exactly that reason).

## Natural / Altered / Built

A second derived facet alongside wild-or-cultivated, added 15 August 2026.
`/natural-or-built/`, plus a Setting row on each photo page.

**It describes the ENVIRONMENT, never the subject standing in it** (Dermot's
wording, and the distinction the whole thing turns on). Natural *environment*,
not natural *subject*. The Bray air-display frames are Natural because sky and
cloud are, though a Mustang is emphatically not a natural subject — they were
first filed Built on exactly that misreading, which could not be reconciled
with *Balloon over the Mara* being Natural. Human presence is Documentary's
job, not this facet's.

**Altered means visible human works in the landscape, never human causation.**
*The Drowned Forest* is Natural: Lake Naivasha rose and the trees died, and
nobody built anything there. On a causation test the Dublin Mountains would
fail too, their heather burned and grazed to keep it heather. Same instinct as
IPF-Nature, which bans human *elements* in frame rather than human *influence*.

Three values, not two, because the interesting photographs sit between: a
reservoir is a manufactured thing that looks like a lake. This is *unlike*
wild-or-cultivated, where a third bucket was rejected — "is the Ha'penny Bridge
cultivated?" is a category error, but "is Bohernabreena natural or built?" has
the real answer "both".

Most of it derives: Architecture and Urban Wildlife → Built; Wildlife, Nature
and Macro → Natural; any `IPF-Nature` tag → Natural, since that tag already
asserts no human element in frame. Only Landscape, Documentary and Creative
need an explicit `setting:` in front matter. **A photo with neither a default
nor an override returns null and does not appear** — deliberately, so a missing
judgement shows as absence rather than a confident wrong answer.

## Notes on a photograph

The markdown **body** of a `src/photos/*.md` file renders as a note under the
title (`photo.njk`, `.photo-note`). It is optional and renders only when there
is body text, so a photo without one still looks finished.

**The house rule: never describe what is visible — add what is not.** A note
earns its place by telling the viewer something the frame cannot.

**A subject that does not read is the exception** (Dermot's ruling, 15 August
2026). Where the subject is genuinely hard to find, a note may point to it, and
saying where to look stops being description because the viewer could not see it
unaided. *Hyena Below the Migration* is the worked example: the hyena is 10.6% of
the frame width, dead centre-bottom, and almost exactly the tone of the muddy
water it is sitting in — Dermot could not find it himself. The test is whether
the subject actually fails to read at page size, not whether it is small; keep
the orientation to one clause at the end and let the rest of the note do the
usual job.

Note what this exception is *not* a licence to do: it does not justify cropping.
The same photo is the case in point — the herd on the skyline and the hyena are
770 px apart vertically, so the tightest 3:2 crop holding both leaves the hyena
at 14.7% of the width, a 1.39× gain that costs the right-hand third of the herd.
That ceiling is the same working from the full-res original on `F:`, so it is the
composition and not the resolution. Where the geometry is what hides the subject,
the note is the fix and the frame stays as shot.

**Baited or arranged encounters must carry one** (standing rule, 14 August
2026). If an animal was fed, called, or otherwise brought to the camera, the
note says so. The four Lake Naivasha birds are the worked example: the boatman
was throwing fish for the eagles and offering fish to the pelicans, and no
amount of looking at a clean sky would tell you that.

This is separate from the `competitions:` tags, which handle eligibility.
Baiting is banned by WNPA and by FIAP, so a baited photo is `[DCC]` at most —
but the tag is for the rulebooks and the note is for the viewer, and both are
needed.

## Competition masters

Photos eligible for either competition get a high-res master in
`F:\Competition Masters\<year>\` (CamelCase title names): 3240×2160 (fit
within DCC's 3840×2160), quality ~92, ≤3 MB, EXIF kept. Downsize to 3000 px
long edge at submission time for WNPA. `README.txt` there carries the full
eligibility manifest and rules summaries. Files still at 1600 px are
placeholders whose originals haven't been located yet.

**The folder is a contender pool, not a final selection** (Dermot's ruling,
23 August 2026, settling a day of cap-widening: 24 → 30 → 48 → 50 → ~60).
With no sharp way to choose a top-N in advance, a master means "in the
running", and **Dermot makes the final pick when a competition is due**.
Guideline is about **60 masters per year**, if and when suitable images are
found; there may be more competitions to choose from than the local
calendar, while 24 remains sufficient for uniqueness in local DCC
competitions — the headroom serves the wider entries, not DCC.

## Image conventions

- Landscape orientation: 1600 px long edge (1600×1067 for 3:2)
- Portrait orientation: 1200×1600
- JPEG, sRGB, roughly 250–550 KB. Minimalist frames (silhouettes, plain skies)
  land well under that at quality 88 — that's fine, don't inflate quality.
- Photos are heavily HDR/vivid-processed in camera (Nikon) — preserve the
  punchy look; downscaling from full-res source tames sky noise.
- Use `sharp` (Node). No ImageMagick/Python on this machine.

## Verifying and shipping

- `npm test` runs `scripts/validate-photos.js` (added 24 August 2026) before
  the Eleventy dry run, and CI runs `npm test`. It fails on what is always
  wrong: a missing required field, a category or `competitions:` tag outside
  the real vocabulary (a typo'd `IPF-Nature` silently misfiles a plant on
  `/wild-or-cultivated/`), an invalid `setting:`, an `image:` that doesn't
  exist or is shared by two photos, an image file no photo references, or a
  duplicate `order` (the homepage picks "newest" by order). It only *warns*
  on a Landscape/Documentary/Creative photo with no `setting:` — that absence
  is a judgement not yet made, and staying off `/natural-or-built/` is the
  deliberate behaviour. The category and competition vocabularies live at the
  top of the script; a new category is added there in the same change that
  introduces it.
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

**The site itself has no numeric cap** (Dermot's ruling, 23 August 2026) —
only two bars: minimum quality, and no duplicates. The masters guideline
above is about competition curation, not the portfolio.

**A burst of related near-duplicates is material, not a problem** (same
ruling). Where several frames of a burst combine in interesting ways,
stacking composites and small GIFs are allowed and *encouraged* — the burst
stacks (*Nine Mustangs over Bray*, *Three Suns over the Mara*) are the
worked examples of the stacking half. The no-duplicates rule still governs
the individual frames: publish the combination or the best single frame,
not the burst spread across several pages. A GIF has no precedent on the
site yet — before the first one, check the pipeline actually carries `.gif`
(the `image:` field, Eleventy passthrough, and `photo.njk`) rather than
assuming it.
