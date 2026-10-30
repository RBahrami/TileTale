# Sliding Puzzle

A small, self-contained sliding-puzzle game for the browser. Four puzzles,
each unlocked with a four-letter password. When a puzzle is solved, the
board fills in the missing piece so the complete picture stays visible,
and that game's predefined answer (for example a Greek letter) appears in
a result panel directly below the image.

- Plain HTML + CSS + vanilla JavaScript. No backend, no database, no build
  step, no runtime dependencies, no external APIs.
- Deploys directly to GitHub Pages and works under a repository subpath.
- Mobile-first, touch-friendly; keyboard arrow keys also work on desktop.
- All customization (board size, difficulty, passwords, images, answers)
  lives in one file: `config.js`.

> The passwords are a game-access mechanism, not a security feature. This is
> a static, client-side application, so the configuration can be inspected
> by any visitor.

## Project structure

```text
/
├── index.html          # markup for the three screens + result panel
├── config.js           # ALL game customization lives here
├── puzzle.js           # pure game logic (shuffle, moves, solvability)
├── app.js              # UI layer (screens, input, rendering)
├── styles.css          # styling
├── package.json        # only used for `npm test` (no dependencies)
├── tests/
│   └── puzzle.test.mjs # logic & configuration test suite
└── assets/
    ├── puzzle-1.jpg … puzzle-4.jpg
    └── README.md       # image notes
```

## Run locally

Serve the folder with any static file server (ES modules do not load from
`file://`, so opening `index.html` directly will not work):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Run the logic tests (Node.js ≥ 18, nothing to install):

```bash
npm test
```

## Deploy to GitHub Pages

1. Push all files to a GitHub repository.
2. Open the repository → **Settings** → **Pages**.
3. Under *Build and deployment*, set **Source** to *Deploy from a branch*,
   choose your branch and `/ (root)`, then save.
4. Your game is available at `https://<username>.github.io/<repository-name>/`.

Every asset path in the app is relative (`./config.js`, `./assets/game-1.jpg`),
so the game works identically when hosted under a repository subpath such as
`/repository-name/`. There is no build step — the repository root is the site.

## Customize

### Replace an image

1. Add your picture to `assets/` (JPG or PNG, any resolution, any aspect
   ratio).
2. Point the `image` field of a game in `config.js` to the new file, e.g.
   `image: "./assets/puzzle-1.jpg"`.

Images are scaled to **fill the whole board, edge to edge**: the picture is
stretched or shrunk independently in both directions to match the board's
shape, so every tile is completely covered and no letterbox is visible.
Each tile shows exactly the part of the scaled picture that sits under its
cell, so the completed puzzle reproduces the full image. For photos whose
aspect ratio differs a lot from the board's, the picture will look
proportionally wider/taller — pick images close to the board ratio if that
matters to you.

### Change a password

Edit the `password` field of a game in `config.js`. Rules:

- exactly four English letters A–Z,
- matched case-insensitively (leading/trailing whitespace is ignored),
- unique across games — duplicates are rejected with a visible error.

### Change the revealed answer

Edit the `answer` field in `config.js`. Any text is allowed — for example a
Greek letter (`Π`, `Η`, `Φ`) or a longer label such as `Maze 1 - Start: Π`.
It is displayed exactly as written in the result panel below the completed
picture — and only after the puzzle is solved.

### What happens on completion

The moment the last tile slides into place, three things happen:

1. The board **reveals the complete picture** — the empty cell fills in and
   the gaps between tiles seal with a short fade, so the solved puzzle stays
   fully visible (nothing covers it).
2. The **result panel appears below the image** with the puzzle's answer and
   an "Enter new password" button. The Restart button and the hint text are
   hidden while the solved picture is on screen.
3. All board input is **locked** until you leave the screen. Arrow keys fall
   back to normal page scrolling so the result is easy to reach on small
   screens.

### Change the puzzle size

The board is fully configurable in `config.js`:

- `boardCols` + `boardRows` — any rectangle, e.g. `4` × `3` (the current
  setting) gives 12 cells / 11 tiles. Both values may be 2–12.
- Alternatively, `boardSize` — square shorthand (e.g. `boardSize: 4` for the
  classic 15-puzzle). Do not set both forms at once.

Both odd and even widths are supported; the correct solvability rule for each
parity is applied automatically. Increase `shuffleMoves` when you make the
board larger.

### Add another game

1. Add the image to `assets/`.
2. Append an entry to the `games` array in `config.js`:

   ```js
   { id: "game-5", password: "QUIZ", image: "./assets/game-5.jpg", answer: "EPSILON" }
   ```

`id` and `password` must be unique. Nothing else needs to change.

### Configuration errors

Invalid values (bad board size, duplicate passwords or ids, missing fields)
produce a clear on-screen error message when the page loads. A missing image
file produces a clear error message when that particular game is started.

## Tests

`npm test` runs `tests/puzzle.test.mjs`, which covers:

- **Shuffling** — 1000 randomized 4×3 boards plus 200 boards each for shapes
  from 2×2 to 6×5 (square and rectangular): every board passes the
  independent solvability check, contains exactly one empty space and all
  tiles exactly once, and is never already solved.
- **Solvability rule** — cross-checked against full breadth-first
  reachability scans for 2×2 (all 24 permutations), 2×3 and 3×2 (720
  permutations each, covering the even-width and odd-width rule branches);
  one-tile-swap boards are rejected.
- **Movement** — only orthogonally adjacent tiles move; diagonal and distant
  moves are rejected; every shuffled board can be replayed back to the solved
  state via inverse moves.
- **Mixing** — shuffled boards are well mixed so real gameplay is required.
- **Configuration** — the shipped config validates, and invalid configs
  (duplicate passwords/ids, bad sizes, missing fields, non-relative paths)
  are rejected.

For browser-level testing, `app.js` exposes a small debug hook,
`window.__puzzle` (`state()` and `setBoard(board)`), which is not used by
normal gameplay.

## How solvability is guaranteed

A random permutation of the tiles is *not* necessarily solvable, so the game
never uses one. Two mechanisms guarantee solvable boards:

1. **Construction.** Scrambling starts from the solved board and applies
   `shuffleMoves` random *legal* moves (a random tile adjacent to the empty
   space slides into it, and the previous move is never immediately undone).
   Because every step is a valid sliding move applied to a reachable state,
   the result is reachable — and therefore solvable — by construction.
   Boards that happen to end up already solved are re-shuffled.

2. **Independent validation.** Every scrambled board is additionally checked
   with the classic inversion-parity rule: reading the tiles left-to-right,
   top-to-bottom and ignoring the empty space, count the *inversions* (pairs
   where a larger-numbered tile appears before a smaller-numbered one).
   For an *odd* board width, the board is solvable iff the inversion count is
   even. For an *even* board width, it is solvable iff
   `(inversions + blank row counted from the bottom, 1-based)` is odd.
   If a generated board ever failed this check it would be discarded and
   regenerated — the tests confirm this never happens in practice.
