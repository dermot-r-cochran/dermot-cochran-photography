# dermot-cochran-photography

Dermot Cochran's photography portfolio. Eleventy static site, deployed to
dermotcochran.com via cPanel on every push to `main`. PRs get a GitHub Pages
preview (`.github/workflows/pr-preview.yml`).

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

## Category rules

Categories in use: Wildlife, Landscape, Architecture, Nature, Macro, Documentary.

- Pure wildlife (no human element) → **Wildlife**
- Not pure wildlife → **Nature** or **Documentary**
- Any "hand of man" in a wildlife/nature scene (vehicles, people, balloons,
  buildings) → **Documentary**
- Photos *of* other people (photographers in action, visitors with animals)
  are good Documentary material — but group photos that include Dermot were
  taken by someone else and must not go on the site.

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

## Dublin Camera Club exports

Competition-ready copies of the published photos live outside the repo at
`C:\Users\Harvey Norman\Dermot Cochran\OneDrive\Pictures\DCC\Competition Entries\<year>\`,
named by photo title. Club projected-image spec: JPEG, sRGB, max 1600×1200
(portrait images therefore max 1200 high). Only the best ~24 photos per year
are needed for club entries. The site images at 1600×1067 already comply and
are copied as-is; anything taller than 1200 px gets resized.

## Source material

Raw camera dumps (JPG + NEF) live in `F:\<NNNXXXXX>\` folders (e.g.
`F:\103KENYA`). Staging folder for one-off photos to process:
`C:\Users\Harvey Norman\Dermot Cochran\OneDrive\Pictures\CLAUDE\`.
Get `year` from EXIF DateTimeOriginal. When choosing from a burst, compare
frames visually — Laplacian sharpness scores track grass texture, not focus.
