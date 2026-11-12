# Learning City – Gameplay Design

Nov 11, 2026 · @Andreas

## Vision & core loop

Kids wobble through a bright open city, earn **Stars** by finishing age-matched homework and movement quests, and spend those Stars on games and videos. The rule of the city is simple: learn first, play later.

The core loop, repeated every session:

1. **Check the quest board** at home or in the Town Hall: today's 3–5 quests, picked for the child's age and level.
2. **Walk to a building** with the keyboard and enter it through the door.
3. **Solve the quest** inside: a learning task (School, Library, Lab) or a camera movement task (Yoga, Dance, Jump Arena).
4. **Collect Stars** and a sticker; the daily goal bar fills up.
5. **Spend Stars** in the Arcade (Memory and other mini-games) or the Cinema (approved videos).
6. **Show it off** at home: trophies, stickers and furniture earned along the way.

The city is the reward too: walking around, jumping, tumbling and finding secrets is free and never costs Stars.

## Look & feel

The city looks like a toy town: soft low-poly shapes, bright pastel colours and round, jelly-like characters that wobble, trip and tumble with physics. Nothing is scary and nothing punishes; a fall is a funny ragdoll moment, not a failure.

- **Characters:** chunky, customisable avatars with floppy arms; kids pick colours, hats and outfits (more unlocked with stickers).
- **Physics fun:** grab and carry objects, push balls, bounce on trampolines, ride a slow bike or scooter.
- **Buildings:** big, readable shapes with a sign and an icon above the door, so even non-readers find the School or Cinema.
- **Sound:** cheerful music, a soft chime for right answers, a gentle "try again" voice for wrong ones — no buzzers.
- **Inside buildings:** each building opens a calm room with one clear task; the city noise fades out to help focus.

How it differs from a wobbly sandbox game: there are no jobs for money, no open goal of earning a big house. The city is a hub, and every building is a doorway into a focused mini-game.

## Player profiles & age tiers

Each child has their own profile with avatar, age tier, Stars and progress, so siblings can share one PC. The same building gives different quests depending on the tier, and difficulty adjusts inside a tier: three right answers in a row step up, two misses step down.

| Tier | Age | How quests are shown | Example quests |
| --- | --- | --- | --- |
| Little Explorers | 4–6 | Icons and voice, no reading needed | Count apples, match letters to sounds, find shapes and colours, easy yoga animals |
| Junior | 7–9 | Short text plus voice | Add and subtract to 100, times tables, read a sentence and pick the picture, spell words |
| Senior | 10–12 | Text, voice optional | Fractions, maps and flags, science experiments, first foreign-language words |
| Teen | 13+ | Text | Equations, logic and coding puzzles, typing speed, vocabulary trainer |

Quest content lives in simple data files (one per subject and tier), so a parent or teacher can add their own word lists or maths sets — for example matching the school curriculum.

## Controls: keyboard + camera gestures

The city and all learning quests are played with the keyboard; the camera switches on only inside sports buildings. A gamepad can be added later with the same layout.

| Action | Keyboard |
| --- | --- |
| Walk | W A S D or arrow keys |
| Run | Shift |
| Jump | Space |
| Enter building / talk / interact | E |
| Grab and carry (wobbly arms) | Q |
| City map | M |
| Quest board | Tab |
| Answer in quests | 1–4 for choices, number keys or typing for maths and spelling |
| Pause / leave building | Esc |

**Camera gestures (sports buildings).** A webcam tracks the child's body pose and hands. Before the first sports quest, a short calibration asks the child to stand so head to knees are visible. Then:

- **Hold a pose:** the avatar shows the target pose (tree, star, warrior, cat); a ring fills while the child holds it for 5–10 seconds.
- **Count moves:** jumping jacks, squats, arm circles are counted by the camera.
- **Copy moves:** in the Dance Hall the child mirrors a dancer's moves in rhythm.
- **Wave to confirm:** a wave works as "OK" so the child doesn't need to run back to the keyboard.

No camera? Every sports building offers a keyboard version (rhythm and reaction games) that pays fewer Stars. Camera images are processed on the PC only and never saved.

## The city & its districts

The city is small enough to cross in about a minute, with Town Square in the middle and one district per kind of building. Kids learn the layout fast and always see where to go next.

&#91;embedded content: city map · 4 districts around Town Square\]

Learning and sports buildings sit on the earning side of town; Fun Boulevard sits behind a gate that opens once the daily goal is reached. Small secrets (a hidden trampoline, a cat on a roof, a ball pit) reward free exploration.

## Buildings: education, sports, fun, play

Education and sports buildings **earn** Stars; play and fun buildings **cost** Stars. Every building has one clear job, so a child always knows why they walk in.

| Building | Kind | What happens inside | Stars |
| --- | --- | --- | --- |
| School | Education | Maths quests: counting, sums, times tables, fractions, equations by tier | +1 per task, +5 for a full set |
| Library | Education | Read (or listen to) a short story, then answer 3 questions | +6 per story |
| Language Café | Education | Order food from a waiter in English, French or German: vocabulary and short phrases | +1 per word |
| Science Lab | Education | Drag-and-drop experiments: mix colours, float or sink, plant growth | +5 per experiment |
| World Tower | Education | Fly a balloon to countries; find flags, capitals, animals | +1 per answer |
| Code Workshop | Education (10+) | Program a robot with arrow blocks to reach a goal | +3 per puzzle |
| Yoga Studio | Sports (camera) | Hold 3–5 poses shown by a calm yoga teacher | +3 per pose |
| Jump Arena | Sports (camera) | Jumping jacks, squats, star jumps to fill a power meter | +5 per round |
| Dance Hall | Sports (camera) | Copy a dancer's moves to a song | +5 per song |
| Arcade | Play | Memory, jigsaw, spot-the-difference, a simple kart race | −3 per round |
| Cinema | Fun | Parent-approved videos (YouTube playlists or local files) | −1 per 2 minutes |
| Building Yard | Play | Sandbox with physics blocks: build towers and knock them over | −2 per 10 minutes |
| Town Hall | Hub | Quest board, daily goal, Star bank, parent settings (PIN) | — |
| Your House | Hub | Decorate with stickers and furniture, trophy shelf | — |

**About videos:** as far as I know, YouTube Kids itself can't be embedded in another app. The Cinema therefore plays videos the parent picked in the parent area, using the normal YouTube player in privacy-enhanced mode or downloaded local files. This keeps the child away from recommendations and endless autoplay.

## Economy: Stars & stickers

One currency keeps it simple for young kids: **Stars**, earned by learning and moving, spent on playing and watching. A second, non-spendable reward — **stickers** — marks milestones and unlocks outfits and furniture.

- **Daily goal first:** the Arcade and Cinema doors open once today's homework quests are done (parent can set the goal, e.g. 3 learning + 1 sports quest).
- **Mistakes never cost Stars.** A wrong answer just means another try with a hint.
- **No grinding the easy stuff:** repeating a task already mastered gives fewer Stars; harder tasks give more.
- **Streaks:** finishing the daily goal several days in a row earns a bonus sticker, not extra screen time.
- **Screen-time cap:** the parent sets a daily maximum for Cinema and Arcade minutes; Stars above that stay saved for tomorrow.
- **Star bank:** the Town Hall shows earned vs. spent today, so kids see the link between effort and reward.

## A sample session

Mia, 8 (Junior tier), plays for about 35 minutes after school:

1. **Wake up at home.** Her avatar tumbles out of bed; the quest board shows three quests: *Times tables ×4*, *Story: The Lost Kite*, *Yoga: 3 animal poses*.
2. **School (8 min).** Ten ×4 tasks; she gets one wrong, sees a hint with groups of dots, then gets it right. **+15 Stars.**
3. **Library (7 min).** She reads a short story, with voice help on hard words, and answers three questions. **+6 Stars.**
4. **Yoga Studio (5 min).** The camera checks her tree, cat and frog poses. **+9 Stars.** The daily goal bar is full; confetti, and the Arcade and Cinema signs light up.
5. **Arcade (6 min).** Two rounds of Memory with animal cards. **−6 Stars.**
6. **Cinema (8 min).** She picks a science video her dad approved. **−4 Stars.**
7. **Home.** She sticks her new "Bookworm" sticker on the wall. 20 Stars stay saved for tomorrow.

## Parent area & safety

A PIN-protected office in the Town Hall gives parents full control; kids can't change any of it.

- **Profiles:** add children, set age tier, language and subjects to focus on.
- **Daily rules:** homework goal, maximum Cinema and Arcade minutes, playing hours (e.g. not after 19:30).
- **Video list:** paste approved YouTube links or playlists, or add local video files.
- **Camera:** on or off per child; off switches all sports quests to keyboard versions.
- **Report:** what each child practised this week, accuracy per subject, minutes moved, Stars earned and spent.
- **Privacy:** everything runs offline on the PC except the approved videos; no chat, no other players, no accounts, no ads.

## Tech approach for PC/Linux & MVP roadmap

Recommendation: build it with web technology packaged as a desktop app, because webcam pose tracking and YouTube playback work out of the box there and it runs on Linux and Windows alike.

|  | Web stack (recommended) | Godot 4 |
| --- | --- | --- |
| 3D city + wobbly physics | Babylon.js or Three.js with a physics engine (Havok / Rapier) | Built-in 3D and physics, great editor |
| Camera gestures | MediaPipe pose tracking runs directly in the app | Needs a helper program (e.g. Python + MediaPipe) sending poses to the game |
| YouTube videos | Standard embedded player | Needs a web-view add-on |
| Linux desktop app | Electron package (AppImage / .deb) | Native Linux export |
| Best if | You like JavaScript/TypeScript | You prefer a game editor and GDScript |

MVP roadmap, smallest playable first:

1. **Tiny town:** one street, walking and wobble physics, Town Hall quest board, one profile, Junior tier only.
2. **Four buildings:** School (maths), Yoga Studio (camera), Arcade (Memory), Cinema (approved video list) — the full earn-and-spend loop.
3. **Parent area:** PIN, daily goal, screen-time cap, video list, weekly report.
4. **More content:** Library, Language Café, all four age tiers, adaptive difficulty.
5. **More movement:** Jump Arena and Dance Hall, keyboard fallbacks.
6. **Polish:** house decorating, stickers, outfits, day/night, sound and voice-over in your languages.
