# Style — creative edits, and the enigmatic frame

Creative direction, kept separate from `CLAUDE.md` because that file holds
mechanical conventions and this holds taste. Conventions are checkable; this
is not.

Adopted 15 August 2026, after one experiment. Dermot's words on seeing it:
*"Exactly what I need to start doing to develop my own style."*

## The finding

**The enigma comes from the cut, not the darkroom.**

The worked example is *The Valve Towers* — a completely legible record shot of
Bohernabreena's waterworks, with a walkway, a railing, a dam wall and a
treeline. Cropping away the top third produced *The Column*: a stone shaft of
unknown height standing in unreadable water, ringed by bands that read as drawn
rather than eroded.

It was already strange **before any tone was touched**. The tone pass only
amplified what the framing had done.

## The method

Ask what in the frame tells the viewer **how big, what for, and where**. That
is the explanatory part. Remove it.

In practice the three cues travel together and usually sit in the same third of
the frame:

| cue | what carries it | what removing it buys |
|---|---|---|
| **scale** | people, railings, vehicles, trees, horizon | the subject could be three metres or thirty |
| **function** | walkways, doors, signage, machinery in use | the subject stops being *for* anything |
| **place** | skyline, vegetation, weather, recognisable ground | it could be anywhere, any decade |

Take out all three and a record becomes an object. Take out one and you have a
slightly tighter record.

**The horizon is usually the whole job.** It carries scale and place at once,
and it is almost always the first thing to go.

## The darkroom pass, which is secondary

Tone amplifies a cut that already works. It cannot rescue one that doesn't.

What worked on *The Column*, as a starting point rather than a recipe:

- **Drain most of the colour.** Saturation to roughly a quarter. Green is the
  worst offender — it makes any water read as *a pond in Ireland*, which is
  three cues at once.
- **Down a little, then contrast up.** Brightness ~0.88, then a linear stretch.
  Deep blacks let a stain and its reflection become one continuous mark.
- **Resist going fully monochrome** unless the frame asks for it. A near-drained
  colour image stays ambiguous; a black-and-white one announces *this is Art*,
  which is its own kind of explaining.

In `sharp`: `.modulate({ brightness: 0.88, saturation: 0.28 }).linear(1.35, -32)`.

## The pairing, which is the actual system

The house rule for a photo note is **never describe what is visible — add what
is not**. That is a generous, explanatory instinct, and it is the right
counterweight to a withholding frame.

- **A frame that withholds + a note that supplies** → the reader arrives
  puzzled and leaves informed. This is the pairing to aim for.
- **A frame that explains + a note that explains again** → the energy leaks
  out. Nothing is gained twice.

So decide which of the two a photograph is *before* writing its note, and let
the note do the opposite of the frame. *The Column*'s note names the pier, the
parent frame and the drawdown terraces — everything the crop took away.

## Constraints that still bind

- **Own work only.** Crop and tone are darkroom decisions and entirely yours.
  Nothing added, cloned, generated or composited — that rule does not bend for
  a creative edit.
- **Lens flare, ghosting and blown sun discs are wanted, not faults.** Never
  "fix" them in pursuit of a cleaner abstract. The dust spot is the only
  blemish that is always a defect.
- **A radical crop of a published frame is a second photograph from one
  negative.** That is allowed — derivative and creative work especially — but
  it is a judgement each time, and the two should do different jobs. *The Valve
  Towers* is Documentary; *The Column* is Creative.
- **Category.** A withheld frame is usually **Creative** — abstract images and
  creative treatments — which also keeps it from reading as a duplicate of its
  own parent.
- **Competitions.** Expect `[DCC]` alone. A crop is not a composite, so WNPA's
  composite ban does not apply, but a masonry or mud abstract is a stretch for
  a nature competition and the claim is rarely worth making.

## Where the material is

A drawn-down reservoir is unusually rich in this, because it is full of
geometry with no obvious explanation. From `111BOHER`, named as next
candidates: **`DSC_2895`** (the eroded spit), **`DSC_2929`** (water and a
curved bank), **`DSC_2860`** (cracked mud).

More generally, look for **repeating structure at an unreadable scale** —
erosion terraces, strata, groynes, masonry courses, ripple fields.

## The idea worth chasing

The portfolio's recurring theme, across seven unrelated outings, is **the act
of watching**: *Watching from the Water*, *Watching the Sunrise*, *Watching
Lions at Dusk*, *Watching the Vultures*, *Cyclists Below Teide*, *Empty Bench,
Greenwich*, *Table for One*, *Poolbeg Watchers at Sunrise*.

That theme **supplies** attention — a watcher tells you where to look. This
style **withholds** it. Put them together and you get the strongest frame
available:

> **A watcher, and no view.** Someone at a rail, on a bench, at a table — and
> the thing they are looking at cropped out entirely.

*Empty Bench, Greenwich* and *Table for One* are already halfway there. They
just have not been cut yet.
