# Brightville – Trommelhaus: Rhythm by Tapping or Clapping (Design)

Nov 20, 2026. Issue #38. Follows the other Lehrplan buildings (Reimhaus, Musterwerkstatt, Kalender, Spielwelt): a
ladder, five tasks, an example while a step is new, the parents' page, and the lessons of their reviews (lit reset
per run, 🔊 stops what is said and forgets a solved question, whole German sentences, no dead taps during examples,
no task with two fair answers).

## Intent

Rhythm: keeping a beat, fast and slow, loud and quiet, and copying a short rhythm. The Lehrplan has this under Musik
(MU) and Zugang 1 (Körper, Gesundheit und Motorik), with Zugang 2 (Wahrnehmung: listening).

**Two ways to answer, chosen by her at the door** (the parent's choice), with the beat always shown on screen too:

- 👆 **Tippen:** big drums on the screen. Always works.
- 👏 **Klatschen:** the microphone hears her claps (the parent's idea): fast enough to judge timing fairly, and it
  measures loudness, so loud and quiet are real tasks.

The camera is not used here (it is slower; the Tanzsaal already uses it for moving).

## Goals

- A building, the **Trommelhaus**, earning Stars like the others (five tasks, at most 10 Stars).
- A seventh Lehrplan ladder, **Rhythmus**, five steps and "fertig", moving up by itself and set by a parent.
- At the door: "Willst du tippen oder klatschen?" with two big buttons; the visit runs in the chosen way.
- Every beat is seen as well as heard: a pulsing light and a bouncing figure.
- The parents' page shows Rhythmus under **Musik**, the first ladder there.

## Non-goals

- Singing, pitch, melodies.
- Recording or keeping any sound: the microphone only measures loudness while she answers; nothing is stored or sent.
- Stepping down by itself.

## Anti-goals

- A buzz or anything that feels like failing: a miss says "Hör nochmal gut zu", plays it again, and she tries again.
- The house judging its own sounds: it never listens while it speaks, and the only thing it plays while listening
  is its quiet drum, which it has measured and doesn't count (below).
- A strict timing judge: a five-year-old is off by a fifth of a second easily; the tolerances are generous.
- A visit that can't go on because the microphone doesn't work: if it is refused, missing or hears nothing for a
  while, the voice says so kindly and the visit goes on by tapping.

## The ladder: Rhythmus

| Step | Asks |
|---|---|
| 1 | **Mitklatschen:** the house drums a steady beat (about 90 per minute); she joins in and keeps it going for eight beats |
| 2 | **Schnell und langsam:** the same at a fast (about 120) or a slow (about 60) beat, said first ("Jetzt ganz schnell!") |
| 3 | **Laut und leise:** "Zweimal leise, dann zweimal laut" (and other orders of four) |
| 4 | **Nachklatschen:** the house drums a rhythm of three or four beats (even beats and quick pairs, "bum, bum, bum-bum"); she copies it |
| 5 | **Längere Rhythmen:** five or six beats, with a pause in them |
| 6 | "fertig": a mix |

**Judging** (pure functions with tests; *my calls, the builder may tune the numbers on the device*):

- **Keeping a beat (1–2):** after four beats to listen, of her next eight beats at least six land within ±200 ms of the
  house's beat (it keeps playing quietly and the light keeps pulsing while she plays).
- **Loud and quiet (3):** tapping: the big drum is loud, the small drum quiet, so each beat is right or wrong.
  Clapping: her loud claps must be clearly louder than her quiet ones in the same task (at least 1.5 times, by peak
  level), in the order asked.
- **Copying (4–5):** the same number of beats, and each gap between her beats within 35 % of the gap in the rhythm
  (so tempo can drift a little, the pattern must match).
- She has 6 seconds after the house finishes to start; then the voice asks again. Two such silences in a task count
  as one try.

**Clapping while the beat goes on (steps 1–2), changed 2026-11-26 after trying it:** a house that went silent after
two beats left her wondering where the beat went. Now it drums the **four beats to listen to loud, then goes on with
its quiet drum** while the light and figure keep the beat, and the instruction says so ("Erst spiele ich laut, dann
leise. Klatsch laut mit …"). So the microphone doesn't take the quiet drum for her claps, the house plays it three times
when the microphone opens and hears how loud it comes in (the quietest counts: a clap or a word meanwhile makes one
louder, and taken for the drum it hid all her quieter claps); while she claps along, only what is at least twice as loud
counts. If it comes in too loud (0.2 and above) or not at all, the house stays silent after the four beats, as
before. In tapping mode the drum keeps sounding.

**The microphone measures only above 400 Hz (2026-11-26):** with the browser's filters off, the room's low hum comes
through. Measured on a laptop at normal input gain: the quiet room read 0.033 unfiltered (so claps had to pass 0.1),
0.002 above 400 Hz; an adult's quietest clap 0.21 and 0.18; the house's quiet drum 0.016 and 0.003. Claps lie mostly at
0.8–3.2 kHz (about 80 % of their energy), so the filter costs them almost nothing. (At full input gain the laptop's
readings were useless either way: the input was overloaded.)

**Three tries a task (my call):** a task is solved when she gets it right; after three misses the house shows it once
more ("Hör zu, so geht's: …"), says "Das üben wir noch. Weiter geht's!", and the task ends: it counts as missed on the
first try and still gives its Star (she kept at it). No task can loop forever.

**Tapping and clapping feed the same Rhythmus ladder (my call):** at step 3 tapping means choosing the big or the
small drum, clapping means making the sound loud or quiet; both show she knows laut and leise. Noted for the parents:
the ladder doesn't say which way she answered.

**Moving up:** of her last 10 answers at the step, at most 2 missed on the first try. Parents can set the step (1–5
or "fertig"). Start step 1.

## The door choice

When she walks in: the two buttons and "Willst du tippen oder klatschen?". On a device without a microphone (or after
it was refused this session) only 👆 shows and the visit starts straight away. Tapping 👏 asks the iPad for the
microphone (that tap is the gesture iPadOS wants). If it is refused or fails: "Das Mikrofon hört gerade nicht zu.
Dann tippen wir!" and tapping it is.

## The microphone

- Only open while she answers; closed while the house plays or speaks, and between tasks. *(My call: on iPads an open
  microphone can make the speaker quieter; closing it between answers avoids that. To check on the device.)*
- Claps are found from the loudness: a sharp rise above the room's own noise (measured in the moment before she
  starts), at most one clap per 120 ms.
- If it hears nothing at all in two tasks running (each with two silent re-asks), the visit switches to tapping by
  itself: "Ich höre dich nicht. Tipp einfach auf die Trommel!" The tasks keep counting as before.
- The microphone service can also keep the stream open and just ignore it between answers, if closing and reopening
  turns out slow or asks again on the iPad (one switch).

## Showing before asking

While the step's window holds fewer than 10 answers (steps 1–5), one example first: the house drums it with the light
and the figure, the voice says what to do ("Hör zu: bum, bum, bum. Jetzt du!" is the task itself; the example plays
it once with the voice counting along). Nothing to tap during the example.

## Tasks of a visit

Five tasks at the step; never the same rhythm twice in a visit. Stars: one per solved task and 5 for finishing, 10 at
most. `minSecondsPerStar` 3 (a task takes several seconds of listening and playing).

## The building in the town

- Id `trommelhaus`, spoken name "Trommelhaus", sign icon 🥁, kind `earn`, needs nothing (tapping always works).
- One more plain scenery house becomes it (the map tests decide), preferably near the Tanzsaal. Its own colour pair.

## Server and app

- `rhythmus` becomes the seventh ladder: window 10, misses 2, start 1.

## Parents' overview

- Under **Musik**: "Rhythmus — Stufe n von 5 „…“". Step texts: 1 „Takt halten“, 2 „schnell und langsam“, 3 „laut
  und leise“, 4 „Rhythmen nachklatschen“, 5 „längere Rhythmen“, fertig.
- **Overall number:** eight shares. **End of Kindergarten:** Rhythmus step 4 reached (60 %): keeping a beat, fast/slow,
  loud/quiet are Kindergarten; copying rhythms is 1st grade. Mark: (40 + 40 + 100 + 60 + 80 + 60 + 60 + 0) / 8 = 55 %.
- Tags: `trommelhaus` gets `MU` and Zugänge 1 and 2.

## Left to the builder

- The drums' and the figure's look, the drum sounds (the existing `playBeat('drum')` or a second, lighter one for the
  small drum), tempos and tolerances within the ranges above, the onset detector's details.
- The split: a pure rhythm module (patterns, judging, onset detection on a stream of levels), a pure flow, the screen,
  a small microphone service (open, levels, close) that tests can fake.
- Timing: beats scheduled from one clock (the audio clock where available), her taps and claps timed on the same.

## Also in this PR

- `docs/roadmap.md`: item 17 and the calls above; README: row, section, parents' paragraph.
