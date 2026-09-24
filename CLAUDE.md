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

**Camera settings that worked in the field live in
[`FIELD-NOTES.md`](./FIELD-NOTES.md)** — per situation (the first is woodland
floor macro on a support), with the reasoning, so a day out starts from the
last day's settings rather than from scratch. Add to an existing entry when a
day confirms or corrects it, rather than starting a new note.

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

**`featured:` (optional) reserves a homepage slide.** The slideshow is
normally the newest photo from each of the 10 most recently added-to albums —
a recency sampler, not a best-of. A featured photo takes a slot ahead of that
and leads the rotation, and within its album it represents the album instead
of the newest photo. `featured: <n>` fixes the slide's position (`1` opens the
rotation); `featured: true` slides follow the numbered ones, newest first. One
slide per album still holds (two featured photos in one album: the first in
that sequence wins), and the cap is still 10, so featuring more than 10 drops
the ones at the back of the sequence. Unflagged behaviour is unchanged — with
no `featured:` anywhere, the slideshow is pure recency.

**`award:` (optional) records a competition result** on the photo page, as the first row of the metadata list — one string, the placing then the competition, e.g. `"First place, Digital Novice Mono — Dublin Camera Club Summer Competition 2026"` (added 8 September 2026 for *Cheetah on the Mound*, the first). Name the section exactly as the club does: DCC runs Digital and Print sections separately, so *Digital Novice Mono* is a different section from the Prints one, and *Novice Mono* on its own names neither (Dermot's correction, 9 September 2026). It is a fact, not a taste call, so add it the day the result is announced; the SUBMISSION LOG in `F:\Competition Masters\README.txt` gets the same result line. **A page that carries `award:` shows the exact version that won** (Dermot's rule, 11 September 2026): the same crop, tone and mono/colour as the file entered, downsized to site size. Add the award line and check the site image against the entered file in the same change; if they differ, swap the image to the entered version, or leave the award line off the page and log it in the masters README only. *Cheetah on the Mound* is the worked example: the monochrome that placed replaced the colour frame, and the note says the colour frame stays in the folder. **Two versions that win different competitions each get their own page** (Dermot's rule, same day): if a colour cut and a mono cut, or two crops, are entered separately and each places, that is a clear exception to the no-duplicates rule, because each page has to show the exact version that won. Each page carries its own `award:` and its own image; the notes cross-reference the other. Placing is not the only route to a second page: a colour and a mono from one raw are not duplicates in any case (see *What is not a duplicate* under Source material), so an unplaced second version may still go up on its own merits. **A competition winner is always added to the site and is on the Selected page** (Dermot's rule, same day, "for completeness, despite my disdain for external validation"): a placing is a fact about the work, so the winning version goes up even if it would not otherwise have been chosen for the site, with its award line, which puts it on `/selected/` by that fact. This never puts anything below his standards on the site, because nothing below them is ever entered: **a competition entry must meet Dermot's own taste standards and every other rule here, the people rule and the sensitive-topic rules included** (his words, 11 September 2026: submitting otherwise "would be a serious error"). Venue-fitting shapes the cut; it never lowers the bar on what is cut. So a winner going up for completeness is a photo that would have cleared the site's bars anyway. **At four or more awarded photos, the winners leave `/selected/` for a section of their own** (Dermot's direction, 11 September 2026). Until then the Selected page carries them, as above; the trigger is the count of pages carrying `award:` (one today, *Cheetah on the Mound*), and four is the same threshold a subject needs before it earns a page. When the fourth lands, the same change builds the awards section, stops `selected/index.md` admitting a photo by `award:` alone, and updates this file and the `selected:` paragraph below; an awarded photo that Dermot has also flagged `selected: true` stays on Selected by that flag. **The Selected page keeps its name** (Dermot's ruling, same day, "leave it as selected"): after the split it holds only his own picks, which is exactly what the word describes, so only the intro sentence admitting competition placings comes out; no rename, and the `/selected/` URL stays. The validator warns at the threshold so the count is not missed.

**`unlisted:` (optional) keeps a photo's page but takes it out of every
list** (added 11 September 2026, the day pages stopped being removed or
renamed). `unlisted: true` is the only value. The page still builds at its
URL for anyone who has the link, with a `noindex` meta; it is in no gallery,
archive, subjects page, slideshow, Selected page or sitemap, and it does not
count toward the subjects floor. The validator fails any other value, and
fails the flag beside `featured:`, `selected:` or `award:`, each of which
would be a promise the page could not keep (an awarded photo is always on
the site by Dermot's rule). Use it where a removal would once have been
used; the image file stays referenced, so the no-orphan check is unaffected.

**`selected:` (optional) puts a photo in the `/selected/` gallery** — the
curated tier above the main gallery, added 29 August 2026. `selected: true` is
the only value; there is no ordering, and the page renders in the same order
as the main gallery. **Which photos carry it was Dermot's call alone until 22
September 2026**, when he replaced free choice with a rule: **one champion per
subject page, on every page carrying six or more photographs.** He asked the
question that prompted it — what the criterion for being on the page actually
was — and the honest answer was that there had never been one for staying on:
the page was a snapshot of twenty-one comparison rounds run on 29 August plus
four later additions, and twenty-nine photographs had been published since
without any of them being put against the champion of their kind.

- **The rule.** Each subject page with six or more photographs has one
  champion, and that champion carries `selected: true`. **This does not mean a
  subject page displays one flagged photograph** — photographs carry several
  subjects, so a page shows its own champion plus any champion of another page
  that happens to carry the same subject, and Trees shows three. The rule
  selects; it does not mark up the browsing pages. A photograph may
  champion several pages — *The Column* takes Drought and Reflections,
  *Lioness with Cubs* takes Lions and Young Animals — and nesting makes no
  difference, so Gulls and Seabirds each choose from everything on their own
  page and may land on different frames.
- **Setting the flag is now mine, with ties escalated.** His instruction:
  *select the best champion of each subject or kind; ask me if there is a close
  tie or unsure.* So propose and apply, but put a genuinely close call to him
  rather than guessing — and always say when a change would take the flag off
  something he picked himself.
- **Why six.** One champion on all 41 pages would have taken the page from 28
  photographs to about 39, a fifth of the site, because there are more subjects
  than he had ever picked. The threshold drops eleven thin pages — Aircraft,
  Bees, Blossom, Boats and Ships, Buffalo, Martello Towers, Mixed Herds,
  Rhinos, Sea, Storms, Winter — leaves thirty qualifying, and lands the page at
  29, within one of the size it already was. A kind with three frames does not
  need a champion.
  *Cape Buffalo* is the one photograph that lost its flag to the threshold
  rather than to a comparison; he said that if a buffalo ever represents the
  kind it should be *Cape Buffalo, in Mono*.
- **What "best" means here is his revealed preference, not a stated rule**, and
  it is worth naming because it decides most pages: across twenty-one rounds he
  chose the distinctive over the technically strong conventional one every
  single time, the behaviour or story frame over the clean portrait, and the
  quiet-but-odd over the postcard. Applied here that is why Trees went to *The
  Drowned Forest*, Skylines to *Zebra Below the City* over the tower, Woodland
  to the *Two and a Half Seconds* blur, and Waterbirds to the *Three Strides*
  triptych ahead of three frames he had picked himself.
- **The at-large tier stays his alone** (his ruling the same day). Twenty
  listed photographs carry no subject at all and so can never be champions;
  one of them, *Rock Hyrax on the Coffee Machine*, was already on the page and
  keeps its flag. Adding or removing a flag outside the 29 qualifying pages is
  still his say-so and nobody else's.
- **A new publish now has a defined consequence**: it joins its subject pages
  and can take a championship from the frame holding it. That is the gap this
  rule closes.
- **The validator enforces it** (added the same day): a subject page of six or
  more photographs with nothing on `/selected/` fails the build. This is a
  gate rather than a warning, unlike the subject floor and ceiling, because a
  page losing its champion is *silent* — an unlisting, a retag or a pass over
  the flags can take the last one away and nothing else would say so. The fix
  is a taste call, so the message names the page and asks for a comparison
  rather than guessing. Note that a page can also hold several flagged
  photographs and still be fine, since the others are champions of other pages
  passing through, so the check is "at least one", not "exactly one".
- **What distinguishes an at-large pick from a champion is, today, that it
  carries no subject at all**, which is why no extra field was added when the
  question came up. That holds only while at-large means exactly that. The day
  something that *does* carry subjects is flagged without being a champion,
  `selected: true` stops being self-describing and needs a real marker — a
  separate field, or a value such as `selected: at-large`. Add it then, not
  before.

**A photo carrying `award:` is on the page too**
(Dermot's direction, 9 September 2026) — a competition placing is a fact, and
`selected/index.md` admits a photo by either field, so an awarded photo needs
no `selected: true` to appear and adding the award is enough — until the fourth awarded photo, when the winners move to their own section (see the `award:` paragraph above). Context: the site's publication bar is
deliberately permissive (anything as interesting as the site's floor goes up
unless too similar), so this page is where the ceiling stays visible. It is
unrelated to `featured:`, which only reserves a homepage slide.

**Country is derived, not written.** There is no `country:` field. `.eleventy.js`
takes the last comma-separated segment of `location`, so "Enkewa, Maasai Mara,
Kenya" and "Maasai Mara, Kenya" both roll up under Kenya, and `/country/` pages
stay correct with nothing extra to maintain. A location with no comma is treated
as a country in its own right. Open water is the one case that can't be parsed —
add it to `AT_SEA_LOCATIONS` in `.eleventy.js` and it groups under "At sea"
(currently just "Baltic Sea").

**Location depth varies; spelling does not** (settled 1 September 2026, after
*Godwits Roosting* briefly sat at "Wexford Wildfowl Reserve, Wexford, Ireland"
while the Saltee photos sat at "Wexford, Ireland", giving one county two
`/location/` pages). `location` is *where in the world* — the region a viewer
would browse by — written as deep as the place needs and ending in the country:
"Wexford, Ireland" and "Maasai Mara, Kenya" are complete, and "Bohernabreena,
Dublin, Ireland" or "Greenwich, London, England" add a segment because the
middle one carries real information. Don't invent a level to make every
location three segments; the country derivation exists precisely so depth can
vary. The rule that does bind is that both `location` and `album` are grouping
keys, so **the same place is always the same string** — "Co. Wexford, Ireland"
beside "Wexford, Ireland" is two pages for one place. `album` is the other axis,
*which outing*: "Great Saltee, August 2026", the site or city plus the month —
no region, country or date grammar, since `location` already carries the
geography on every photo and the album name is a label and a URL. A specific
site therefore lives in the album, not the location, unless the site is itself
the region a viewer would look for.

**Subjects are the one overlapping axis** (built 3 September 2026, after the
question whether the site needed a topic index for collections such as big
cats, mushrooms or skies). Every other grouping field is single-valued —
category is genre, location and album are exclusive by meaning — and none of
them says what is *in* the frame, which is how a viewer thinks about wildlife:
Wildlife was 65 photos with nothing between it and a 29-photo album. So:

- `subjects: [Wild Cats, Big Five, Silhouettes]` is an **optional list**, and
  a photo carries as many as apply. A subject with one or two frames (the
  giraffe, the hyraxes) carries none, and an absent key means exactly that.
- **The vocabulary is fixed**, in `scripts/validate-photos.js` beside the
  categories, and a word outside it fails `npm test`. Free-text subjects were
  rejected because they drift: "Big Cats", "big cats" and "Cats" is three
  pages for one subject, the same failure the location spelling rule exists
  for. The name is *Wild Cats*, not *Big Cats*, because the serval is in it. The
  field is called `subjects` rather than `keywords` because that is what it
  holds; "keywords" would suggest free text, which it is not.
- **A subject earns its page at four photos.** The validator counts and
  *warns* below that floor rather than failing, because a subject slipping
  under it is a decision — retire the word, or tag the photos that should
  carry it — and a gate would just teach the eye to skip the warning. A new
  subject joins the vocabulary in the same change that first tags a photo with
  it, and earns its place at two (Dermot, 21 September 2026: *two or three can
  be a group*, which covers creating a subject and not only comparing against
  one). The preferred band is four to fifteen; `SUBJECT_CEILING` warns over
  twenty, where a subject has stopped being a kind to browse.
- **Nesting is declared once and rolled up, never double-tagged** (21 September
  2026). `SUBJECT_PARENTS` in `lib/derivations.js` holds the hierarchy — Gulls
  sits inside Seabirds, Lions inside Wild Cats — and `subjectsWithParents`
  files a photograph under the wider kind as well, so the Seabirds page shows ten
  while only two photographs carry the word. **Tag the narrowest kind that fits;
  the wider one is implied, and tagging both fails the check.** Before this the
  hierarchy was encoded by tagging both. The two counts differ
  on purpose: the floor and ceiling read the page count, which is what a visitor
  browses, and the message names the tagged count beside it. **`Birds` is the exception** (Dermot, 21 September
  2026): as an umbrella over Waterbirds, Seabirds and Birds of Prey it reached 51
  photographs, a quarter of the site, so it was split. A photograph that carries a
  bird *kind* no longer carries `Birds` as well, and `Birds` is now the residual
  term for the birds no kind covers — doves, a starling, a roller, an ostrich. Note
  that `Birds in Flight` is a treatment tag rather than a kind, so a photograph
  carrying only that keeps `Birds`. Because a residual page hides where the
  rest went, the Birds page carries a *More birds* line linking Birds of Prey,
  Seabirds, Waterbirds and Birds in Flight (22 September 2026) — declared in
  `SUBJECT_SEE_ALSO` beside `SUBJECT_PARENTS`, and deliberately not nesting, so
  it links the kinds without rolling them back up. Flowers got the same line
  the same day, linking Garden Flowers and Blossom. Roses was dropped because
  the St Anne's Park album *is* the roses page. Treatment tags
  (Silhouettes, Reflections, Birds in Flight, Feeding) describe the photograph
  rather than the subject and are the most subjective to tag — one look at the
  frame each, the same discipline as the competition tags. Seasons (Spring,
  Autumn, Winter) only mean anything for Ireland and Scandinavia; every Kenya
  frame is October.
- **`Blossom` was split out of `Flowers` on 21 September 2026, and it sits inside
  `Trees`, not inside `Flowers`.** Dermot asked whether Flowers should divide into
  wild and cultivated. It should not: the site already carries that axis at
  `/wild-or-cultivated/`, derived from category and the IPF-Nature tag, so the
  split would have said the same thing twice — and it would not have worked
  anyway, since the cultivated side held eighteen of the twenty-one and stayed
  over the ceiling. The division that does describe the photographs is a flowering
  tree seen whole against a single flower head seen close: *Blossom Tree at
  Farmleigh*, *Chestnut Blossom Branch*, *Horse Chestnut in Bloom* and *The
  Rhododendron Arch*, all four of which already carried `Trees` and `Spring`. That
  takes Flowers to 17 and leaves Trees at 19, because the rollup gives Trees back
  what it lost. **Note the mechanism**: a child does not shorten its parent's
  page, so nesting Blossom under Flowers would have fixed nothing — it had to
  become a sibling under a different parent. `Roses` remains off the table for the
  reason above.
- **`Garden Flowers` was added on 21 September 2026, and it sits inside
  `Flowers`.** Dermot's ruling, after I had argued against it: the site already
  draws the wild/cultivated line at `/wild-or-cultivated/`, so a subject on the
  same axis states it twice. His answer is that a facet and a subject are not the
  same thing — the facet is a way to filter the whole site, the subject is a page
  you browse — and of the two names he chose **Garden Flowers** over *Cultivated
  Flowers*, because it names where the photograph was taken rather than what a
  gardener did before he got there. **Which flowers are garden ones is not judged
  page by page**: it is read from `wildOrCultivated` in `lib/derivations.js`, so
  the subject and the facet cannot drift apart. Twelve listed photographs carry
  it; three stay on `Flowers` directly — *Spear Thistle*, *Hoverfly on Thistle
  Flower* and *Wild Angelica* — which makes `Flowers` the residual term for wild
  ones, the same shape `Birds` took after its split. **There is deliberately no
  `Wild Flowers` subject yet.** Three would clear the floor, but symmetry is not
  a reason to make a page, and the Birds precedent leaves the residual on the
  parent. Add it when a fourth wild flower arrives and it is worth browsing. Note
  that `Blossom` is *not* under `Flowers` and so is not affected: a flowering
  tree sits under `Trees`.
- **`Big Five` was retired on 21 September 2026, and the reason is a values one.**
  Every other subject here is a thing in the frame or a quality of the
  photograph; Big Five is a hunting-era checklist kept alive by safari
  marketing, and it describes nothing you can see — a lion portrait and a
  buffalo in mono share a page only because a brochure says so. The structural
  tell was that splitting it would have left it holding one leopard. Its 23
  photographs went to kinds that describe them: Elephants (10, unchanged),
  Lions (8, new, sitting inside Wild Cats), Rhinos (2, new), Buffalo (2, new),
  and the single leopard to Wild Cats, which it already carried. Nothing was
  orphaned and nothing outside the generated index linked to the facet.
- **`Monochrome` was added on 22 September 2026, and it is a treatment tag
  that needs no judgement.** Dermot's framing: mono can be treated as a kind of
  subject or as a kind of treatment. In this vocabulary those are the same
  mechanism — Silhouettes, Reflections, Birds in Flight and Feeding are all
  subjects, and what makes them treatments is only that they describe the
  photograph rather than what is in it. Mono is the best-behaved member of that
  group, because it is a fact about the file: measuring mean saturation across
  every image on the site returned eight at exactly zero and nothing between
  them and the next frame at 0.069, so the set is found rather than decided.
  The eight are *Cheetah on the Mound*, *Cape Buffalo, in Mono*, *Tusker on the
  Plain, in Mono*, *Spotted Hyena at the Den, in Mono*, *Dalkey Island, in
  Mono*, *Vulture Landing, in Mono*, *Great Black-backed Gull with Chick, in
  Mono* and *Parasol* — note that the last two of those do not say so in the
  title, so **never build the set from titles**. The name is *Monochrome* and
  not *Mono*, though every title says Mono, because a browsing facet is read by
  people who have not seen the titles. It gives *Spotted Hyena at the Den, in
  Mono* its first subject of any kind. Its champion is *Cheetah on the Mound*,
  already on `/selected/` by its award, so the page adds a kind to browse and
  nobody to the selection — which is worth saying because the question that
  prompted it was whether a Monochrome page would get *Cape Buffalo, in Mono*
  onto Selected. It does not, and the honest reason is that the cheetah is the
  better monochrome.
- **`Coast` means the coast is the picture, not the place it was taken**
  (Dermot's ruling, 22 September 2026, looking at the page: *not all those
  images show enough coast*). Land and sea have to be in the same frame and the
  meeting of the two has to be what the photograph is about. An animal on a
  rock with sea washed flat behind it is a photograph of the animal; it carries
  its kind and not `Coast`. Nine frames lost the word on that reading — the
  gull and gannet portraits from Dalkey Island, Great Saltee and Ireland's Eye,
  three of which showed no sea at all — taking the page from 19, one under the
  ceiling, to 10. *Grey Seals Hauled Out* kept it: weed-covered rock above the
  tide is the intertidal zone, and that meeting is the frame. Nothing was
  orphaned, because every frame that lost `Coast` is on `Gulls` or `Seabirds`
  already. **The test is the frame, never the location or the album** — half
  the site is shot within sight of Dublin Bay, so "taken at the coast" would
  make the word mean nothing.
- On the photo page the row is labelled **Subjects**. The wild-or-cultivated
  facet's row was labelled "Subject" until this change and is now **Wild or
  cultivated**: it is a scope laid over the subjects, not the subject itself
  (Flowers holds both a spear thistle and a dahlia), and the rows are grouped
  so the four that describe the picture — Category, Subjects, Wild or
  cultivated, Setting — come before the four that describe the outing.

**Wild vs cultivated is derived too.** No field for it either.
`/wild-or-cultivated/` reads `competitions:` — `IPF-Nature` bans cultivated
plants and ornamental gardens outright, so the tag *is* the wild marker.

**It is a strict binary — every photo in scope is Wild or Cultivated, never
both and never in between — and the scope is plants** (Dermot's ruling,
24 September 2026). `IPF-Nature` is a *compound* test (wild AND no human
element AND not cultivated AND not feral), and for a plant the only realistic
way to fail it is cultivation, so within that scope it is an exact marker.

- **Macro and Nature → `IPF-Nature` decides.** A Nature frame with an animal in
  it (*Hoverfly on Thistle Flower*) is labelled by the plant.
- **Wildlife and Urban Wildlife are out of scope.** They were filed Wild by
  category until 24 September 2026, which put the row on every animal page to
  repeat what the category already said. "Cultivated" is a plant word: the
  animal question is wild, captive or domestic, and the category rules already
  answer it (captive or hand of man → Documentary). A zoo animal has no honest
  bucket here either way, so animals have none.
- **Everything else is out of scope** and gets no Wild or cultivated row; the
  question is meaningless for architecture.

So getting a *competitions* tag wrong on a Nature or Macro photo misplaces a
plant, and shows up in two places — this page and the Garden Flowers subject,
which reads the same function.

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
  component is his. Effectively every site photo qualifies. **The tag names
  the open competition**; the club's nature competitions follow the FIAP
  definitions below, so a baited or captive frame that carries `DCC` is
  open-only (Dermot, 15 September 2026). Digital spec:
  JPEG sRGB, max 3840×2160 px, max 3 MB.
- **WNPA** (World Nature Photography Awards): nature subjects only; **no
  captive or restrained animals** (Giraffe Centre shots are out), **no
  composites** or object addition/removal, no baiting — the rule as published
  (checked 15 September 2026) bars "live bait, dead bait, food lures, feeding,
  feeding stations, scent, sound or call playback, captive prey, or any other
  method of attraction or manipulation … where it alters natural behaviour",
  which a fish thrown to eagles that come to the boats plainly does. Spec: JPEG, longest
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
  removal and crops are fine. **Technical fixes are allowed; cloning or
  healing never is, for any nature or wildlife competition** (Dermot,
  21 September 2026, on *Cross Bills*, a third marabou removed from the
  corner). Technical means dust-spot healing, denoising, sharpening,
  exposure, white balance, crop: things done to the camera's rendering.
  Cloning or healing scene content, adding or removing anything, is out
  for IPF-Nature, IPF-Wildlife, DCC nature rounds and WNPA alike. A
  cloned or healed frame is `[DCC]` (open) at most; say in the PR body
  what was healed.
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

**`Mixed` is the fourth value** (Dermot's direction, 24 August 2026: a new
category for photos where the environment is mixed or unsure). It is for
frames whose environment genuinely cannot be filed as one of the other three —
mixed ground, or a call that resists being made cleanly. The distinction that
keeps it honest: `setting: Mixed` is a **recorded judgement** ("I looked, and
it is both / it will not settle"), while an absent `setting:` still means
"not yet judged" and still keeps the photo off `/natural-or-built/`. So Mixed
never becomes the lazy default — reaching for it requires the same look at the
frame the other values do. It is explicit-only: no category or tag derives it.

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
and **`DCC` means the club's open competition only** (Dermot's ruling,
15 September 2026: *Fish Eagle with a Catch* "would count as Wildlife in
general but not for IPF or DCC competitions … would still be allowed in DCC
open but not for DCC nature"). The club's nature competitions run on the
federation's definitions, so a baited frame is out of them exactly as it is
out of IPF-Nature and IPF-Wildlife; the `DCC` tag never claimed otherwise,
and this paragraph now says so. The category stays Wildlife, the tag is for
the rulebooks and the note is for the viewer, and both are needed.

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
- Use `sharp` (Node). No ImageMagick on this machine. Python 3.14 is present;
  `pip install --target <scratch dir> rawpy numpy pillow` gives a raw (NEF)
  developer without touching the system install - used when a frame is dark or
  blown and the JPEG has already lost it (`F:\CLAUDE\Photo Review\_tools\develop-pastel.py`).

## Verifying and shipping

**In a fresh checkout, run `npm ci` before anything else** (22 September 2026).
`node_modules/` is gitignored and `package-lock.json` is committed, so a
machine that has never built this site has no packages at all — which is the
normal state of a Claude Code cloud session, where the repository is cloned
fresh into a container and nothing is installed. The unit suite survives that
— `test/*.test.js` imports nothing outside `node:` — so `npm test` reports 30
passing tests and then stops dead at its second step, where
`scripts/validate-photos.js` dies at its `require("gray-matter")` on line 23.
The `&&` chain means the Eleventy dry run never runs at all; it would fail
too, there being no Eleventy either. **The trap is the middle step, because it
reads as a broken script rather than a missing install**: a session adding the
BOM check planted a mark on a file, saw no failure, and spent a while doubting
the guard, when the validator had in fact aborted at that require and never
looked at the file at all. `npm ci` rather than `npm install`, since it
installs the committed lockfile exactly, which is what CI and the cPanel
deploy both do.

**Read front matter with `gray-matter`, never with a regex** (22 September
2026, learned the hard way, twice in one day). Three photo files began with a
UTF-8 BOM — `african-fish-eagle.md`, `fish-eagle-over-the-drowned-forest.md`
and `great-white-pelican-on-naivasha.md`. Eleventy and
`scripts/validate-photos.js` both parsed them correctly, because `gray-matter`
strips the mark, so nothing here ever showed it. A throwaway
`split(/^---$/m)` does not strip it: the BOM sits before the opening `---`, so
the split lands on the *closing* delimiter and hands back the note body as if
it were front matter, and those three photographs read as having no title and
no subjects and vanish from whatever is being counted. That is how a
one-champion-per-subject pass came to miss that Birds of Prey holds eleven
photographs rather than nine and that Birds in Flight qualifies at all — and,
the same day, how a tool in `applied-statistics-for-ai-engineers` counted 176
photos carrying `subjects:` where 179 do. Two lessons, and both hold. The
repo already depends on `gray-matter`; use it for any script that reads these
files, including a five-line one. **And the mark itself is now a validator
failure** — see the `npm test` bullet below — so the three files have been
re-saved without it and a fourth cannot arrive unnoticed. A defect invisible
to every reader inside the repository was never going to be found from inside
it.

- `npm test` runs the unit suite (`node --test test/*.test.js`, added
  27 August 2026 — it pins `lib/derivations.js`, the derived facets and
  homepage slideshow selection extracted verbatim from `.eleventy.js` so
  they are testable without booting Eleventy), then
  `scripts/validate-photos.js` (added 24 August 2026), then the Eleventy dry
  run; CI runs `npm test`. The validator fails on what is always wrong: a
  missing required field, a category or `competitions:` tag outside the real
  vocabulary (a typo'd `IPF-Nature` silently misfiles a plant on
  `/wild-or-cultivated/`), a `subjects:` entry outside the fixed vocabulary
  or repeated, an invalid `setting:`, an `image:` that doesn't
  exist or is shared by two photos, an image file no photo references, a
  duplicate `order` (the homepage picks "newest" by order), or a `featured:`
  that is neither `true` nor a positive integer — or a numeric featured
  position claimed twice (since 27 August 2026; a quoted `"1"` silently
  becomes an unranked slide and `0`/`false` silently behave as unflagged, so
  only the two meaningful shapes are accepted), or a **UTF-8 byte order
  mark** before the opening `---` (since 22 September 2026). That last one is
  the only check here written for a reader other than this build: gray-matter
  strips a BOM, so a marked file renders perfectly and the mark is invisible
  from inside the repository, while any other reader of the front matter sees
  none and drops the photo without a word. Three files carried one until a
  tool in `applied-statistics-for-ai-engineers` counted 176 photos carrying
  `subjects:` where 179 do — which is how they were found. It only *warns* on a
  Landscape/Documentary/Creative photo with no `setting:` — that absence
  is a judgement not yet made, and staying off `/natural-or-built/` is the
  deliberate behaviour — on more than 10 `featured:` photos, where the
  documented cap drops the back of the sequence — and on a subject carried by
  fewer than four photos, the floor under a `/subjects/` page. The category and
  competition vocabularies live at the top of the script; a new category is
  added there in the same change that introduces it. The full testing
  picture — what fails vs warns and why, and how to extend the validator —
  is written up in `TestingStrategy.md` (added 24 August 2026): mechanics
  there, editorial rules here, taste in `STYLE.md`.
- Build locally with `npm run build`; check the new pages exist under `_site/`
  and that every `images/photos/*.jpg` reference resolves.
- `gh` (GitHub CLI 2.98) is installed and authenticated as of 2 September
  2026: `gh pr create --head <branch> --base main --body-file <file>` opens a
  PR (`--head` is needed explicitly here), `gh pr checks <n> --watch` follows
  CI, `gh pr merge <n> --merge --delete-branch` lands it. The REST-API route
  with the token from `git credential fill` still works as a fallback. CI runs
  `npm test` (validator + Eleventy dry run), ShellCheck over the deploy
  scripts, a shared-scripts check, and a PR preview deploy; wait for all of
  them before merging.
- **Four deploy scripts are shared, byte-identical, with `star-rangers`** —
  `deploy-lib.sh`, `mail-lib.sh`, `ensure-node.sh` and `cpanel-autopull.sh`
  (`cpanel-deploy.sh` is each repo's own). Since 24 August 2026 CI's
  shared-scripts job diffs them against the sibling's `main` (both repos,
  pointing at each other): pre-existing drift fails, while a PR that is
  itself changing a shared script only warns, since the identical edit lands
  in the sibling as its own PR and one of the two has to merge first. So
  change one of these and land the same edit in `star-rangers` in the same
  piece of work.

Dermot's DCC submission workflow folders (`Ready for Submission`,
`Submitted Images`) are in `...\OneDrive\Pictures\DCC\`; he submits via
Pixoroo.

## Source material

Raw camera dumps (JPG + NEF) live in `F:\<NNNXXXXX>\` folders (e.g.
`F:\103KENYA`). Staging folder for one-off photos to process:
`C:\Users\Harvey Norman\Dermot Cochran\OneDrive\Pictures\CLAUDE\`.
Get `year` from EXIF DateTimeOriginal. When choosing from a burst, compare
frames visually — Laplacian sharpness scores track grass texture, not focus.

**The site itself has no numeric cap** (Dermot's ruling, 23 August 2026,
reaffirmed 11 September 2026). The masters guideline above is about
competition curation, not the portfolio.

**The publication bar is best-in-group** (Dermot's ruling, 11 September
2026, replacing the earlier "as interesting as the site's floor"): a new
photo must be at least as good as, and preferably better than, every
existing photo with the same **location, category, setting and subjects**.
The comparison set is the pages that match on all four; if none does, the
photo has no peer and the old floor applies. **Under-represented groups get
flexibility** (Dermot, same evening): with fewer than four existing pages in
the group, the bar softens toward the floor, since a group that small is
still being filled rather than refined. Four is the same threshold a subject
needs before it earns its own page. At four and above, best-in-group holds
in full. "As good as" is a judgement
made by looking at the candidate beside its peers at the same size, and
the PR says which peers it was set against and why it holds up. This is
the bar for the site; competitions have their own ([[competition-selection-bar]]
in the memory store, and the masters README).

**Mono conversions carry a higher quality gate than colour** (same ruling,
restated by Dermot as "a higher quality gate for mono in general"): the
technical bar for a mono page sits above the bar for any colour page, so
critically sharp, clean and well exposed are the entry conditions, and the
mono must then be clearly better in mono than in colour. **Where the gate is judged** (Dermot's question the same night, "what was
the criterion that lifted the Buffalo"): on the elements that carry the
picture, at display size. A mono lives on its edges, its masses and its
tonal contrast; fine texture is secondary. So a frame whose outline, mass
and eye are sharp and whose softness sits only in texture at 100% (the
buffalo: horn edge, black bulk against pale grass and the stare all crisp,
fur soft) can pass when its graphic merit is exceptional. Texture-only
softness is a penalty to weigh, not a veto; softness on an edge, a mass or
an eye is a veto. Say which it was in the PR. *Cape Buffalo, in Mono* is the
worked example, and this criterion, not a waiver, is why it is up. Mono is exceptional on the site, not a
programme, and the best-in-group bar applies to a mono against the other
monos in its group as well as against the colour pages.

**An award winner is never taken off the site, whatever other rule points the
other way** (Dermot, 21 September 2026, in those words). This is the one rule
here that overrides every other: the best-in-group bar, the swap rule, the
thinning rule, and any future reason for unlisting. A placing is a fact about
the work, and the site does not un-say a fact because a later comparison is
unflattering. It is enforced rather than trusted - `scripts/validate-photos.js`
fails any page that carries `award:` beside `unlisted: true`, and the failure
message names this ruling. If a group is over-represented and the weakest frame
in it happens to be a winner, thin a different one or thin nothing.

**Pages are not removed or renamed** (Dermot's ruling, 11 September 2026):
a published URL may be linked from outside, and taking a page down or
changing its slug can break that later. Withdrawals and renames made before
this date stand and are not an issue; from here on, a photo that should no
longer show gets `unlisted: true` (above), never a deletion or a rename.
**Swapping out to unlisted is allowed** (Dermot, same night): when a new
photo clears the best-in-group bar and makes an existing page in the group
the weakest, that page may be unlisted in the same change, so the group
improves rather than merely grows. The swap is named in the PR with the
reason, it is his call when the two are close, and the unlisted page keeps
its URL as always.

**Thinning an over-represented group is a second reason to unlist** (Dermot's
decision, 21 September 2026, and the first use of unlisting with no new photo
arriving). The swap rule above needs a newcomer to displace someone; this does
not. Where one afternoon has put several near-interchangeable frames on the
site, the group may be cut back to the ones that carry it, by the same
best-in-group comparison, in a change of its own. The worked example is the
roses: eight of the seventeen Flowers photographs came from St Anne's Park in
July 2026, five of them a rose alone, and two of those five were the same yellow
rose in the same light against the same background - two attempts at one
photograph rather than two photographs. *Amber Rose in Dappled Light* and
*Golden Rose in Full Bloom* were unlisted; *Blush Rose Unfurling*, *Coral Rose
Among the Leaves* and *Cream Rose with Crimson Heart* stay, because each is a
different kind of rose photograph. **The test is one champion per kind, not a
quota** - nothing here caps how many photographs a group may hold, and a group
of genuinely different frames is not over-represented however large. Both pages
keep their URLs, as always.

**Find these by counting, not by hunch** (22 September 2026). Asked which pages
were worth the same look as the gulls, I guessed from album names and guessed
wrong: Dalkey Island and Great Saltee turned out near the bottom. The check that
works is to walk every subject page and ask what share of it comes from a single
album, then look at the top of that list — the Kenya trip supplies the most
concentrated pages, Aircraft is 4 of 4 from one air show, Birds of Prey 8 of 9
from one Mara outing. **Concentration is a prompt to look, not a verdict**: of the
eleven pages over half, Winter, Elephants, Birds in Flight, Antelope and Martello
Towers were clean, and Aircraft's two Mustang stacks are two pictures because one
is a flowing arc at even scale and the other puts a single aircraft huge in frame.
Four pairs did come out of it, read the same way as the herring gulls — one scene,
two frames, one tighter — and three were unlisted: *Bee Approaching an Amber Rose*
(the same rose and the same bee, which crawls onto the stamens between frames),
*The Valve Towers* and *The National Maritime Museum*. **The fourth stayed, and
why it stayed is the rule worth keeping.** *The Coalition* is the same two lions
in the same grass as *Lion Portrait at Dusk* and is flat and underexposed beside
it — but it carries `selected: true`, and Dermot left it listed: **a `selected:`
flag is a taste call and outranks a technical read against the frame**, and it is
the only photograph on the site showing two males together, which is what the word
means. So check for `selected:` before proposing an unlisting, say so when it is
there, and let him decide rather than treating his answer to a comparison as
consent to drop his own pick. Note the shape of the bee one:
the plain version of that rose was already unlisted in the roses pass, and the
bee frame survived only because it sat on a different page — **a thinning pass
cleans the page it is looking at, not the frame**, so a scene can survive on a
second page it also carries.

**A burst of related near-duplicates is material, not a problem** (23
August 2026). Where several frames of a burst combine in interesting ways,
stacking composites and small GIFs are allowed and *encouraged* — the burst
stacks (*Nine Mustangs over Bray*, *Three Suns over the Mara*) are the
worked examples of the stacking half. The no-duplicates rule still governs
the individual frames: publish the combination or the best single frame,
not the burst spread across several pages.

**Near-duplicates: the three grounds for a second page** (Dermot's ruling,
11 September 2026). Two versions of one raw may each have a page on any one
of these, each sufficient by itself:

1. **Different competition awards** — each version placed somewhere, and an
   awarded page must show the exact version that won.
2. **Mono versus colour** — a monochrome edit and a colour edit are two
   pictures, at the same crop or not.
3. **A very different composition** — a crop that changes what the picture
   is about, not a trim.

Outside those three, the no-duplicates rule holds: the same frame at two
sizes, a light recrop, or a burst spread across pages is one page. Each
version still clears the site's floor on its own merits. **The worked example
of the rule catching something already published** is *Herring Gull Portrait*
and *Herring Gulls Resting on the Rock* (22 September 2026): the same herring
gull in the same pose on the same lichen ridge, same companion behind, same
weed at the right edge, the second a tighter crop of the first. The companion's
head has turned between them, so they are two frames of one burst rather than
one file cropped twice — the same answer either way. Dermot kept the tighter
crop, where the black-and-white wingtip becomes the incident and the companion
reads as a bird instead of a white lump; *Herring Gull Portrait* is unlisted and
keeps its URL. **The second instance came the same day**: *Table for One* and
*Pigeon on the Café Tray* are the same pigeon on the same tray on the same
table, a crop apart. *Table for One* stays — the empty seats and the cobbles
are what make it a joke rather than a bird portrait, and it is the Birds
champion — and *Pigeon on the Café Tray* is unlisted. **Two frames that differ only in how far in you cropped are one
photograph**, and the cue that found this one was a subject page showing five
frames from a single afternoon side by side — worth doing deliberately when one
outing dominates a page. A GIF has no precedent on the
site yet — before the first one, check the pipeline actually carries `.gif`
(the `image:` field, Eleventy passthrough, and `photo.njk`) rather than
assuming it.
