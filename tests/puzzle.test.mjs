/**
 * Automated tests for the sliding puzzle game logic and configuration.
 *
 * Run with:  npm test   (equivalent to: node --test tests/puzzle.test.mjs)
 *
 * The shuffle/solvability functions are tested repeatedly — thousands of
 * boards across many shapes (square and rectangular) — not just once. The
 * solvability rule is additionally cross-checked against full breadth-first
 * reachability scans for 2x2, 2x3 and 3x2 (state spaces small enough to
 * enumerate completely).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  canMove,
  countInversions,
  createSolvedBoard,
  isSolved,
  isSolvable,
  moveTile,
  neighborIndices,
  shuffledBoard,
} from "../puzzle.js";
import { CONFIG, validateConfig } from "../config.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Deterministic PRNG (mulberry32) so tests never flake. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) out.push([arr[i], ...p]);
  }
  return out;
}

/** All states reachable from the solved board via legal moves. */
function reachableStates(cols, rows) {
  const start = createSolvedBoard(cols, rows);
  const seen = new Set([start.join(",")]);
  const queue = [start];
  for (let qi = 0; qi < queue.length; qi++) {
    const current = queue[qi];
    const blank = current.indexOf(0);
    for (const nb of neighborIndices(blank, cols, rows)) {
      const next = moveTile(current, cols, rows, nb);
      const key = next.join(",");
      if (!seen.has(key)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }
  return seen;
}

test("solved board layout, 4x3 and 4x4", () => {
  assert.deepEqual(
    createSolvedBoard(4, 3),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0]
  );
  assert.ok(isSolved(createSolvedBoard(4, 3), 4, 3));
  assert.ok(isSolved([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0], 4, 3));
  assert.ok(!isSolved([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 11, 0], 4, 3));
  assert.ok(isSolved(createSolvedBoard(4, 4), 4, 4));
  assert.ok(!isSolved([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 12, 14, 15, 0], 4, 4));
});

test("solvability rule, even width 4 on a 4x3 board", () => {
  const solved = createSolvedBoard(4, 3);
  assert.equal(countInversions(solved), 0);
  assert.ok(isSolvable(solved, 4)); // 0 inversions + blank 1 row from bottom = odd

  const oneMove = moveTile(solved, 4, 3, 10); // tile 11 slides into the blank
  assert.ok(isSolvable(oneMove, 4)); // must stay solvable, still 0 inversions

  // one transposition on an even-width board => unsolvable
  const swapped = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 11, 0];
  assert.equal(countInversions(swapped), 1);
  assert.ok(!isSolvable(swapped, 4));
});

test("solvability rule, odd width 3 and even width 2", () => {
  const solved3 = createSolvedBoard(3, 3);
  assert.ok(isSolvable(solved3, 3));
  const swapped3 = [1, 2, 3, 4, 5, 6, 8, 7, 0]; // one transposition
  assert.equal(countInversions(swapped3), 1);
  assert.ok(!isSolvable(swapped3, 3)); // odd width: odd inversions => unsolvable

  assert.ok(isSolvable(createSolvedBoard(2, 2), 2));
  assert.ok(!isSolvable([2, 1, 3, 0], 2));
});

test("isSolvable rejects malformed input", () => {
  assert.ok(!isSolvable([1, 2, 3], 4)); // length not a multiple of cols
  assert.ok(!isSolvable([], 4));
  assert.ok(!isSolvable(null, 4));
  assert.ok(!isSolvable(createSolvedBoard(3, 3), 4)); // wrong width vs. layout
  assert.ok(isSolvable(createSolvedBoard(3, 3), 3));
  assert.ok(isSolvable(createSolvedBoard(4, 3), 4));
});

test("2x2 solvability rule matches BFS reachability for all 24 permutations", () => {
  const [cols, rows] = [2, 2];
  const seen = reachableStates(cols, rows);
  let solvableCount = 0;
  for (const p of permutations([1, 2, 3, 0])) {
    assert.equal(isSolvable(p, cols), seen.has(p.join(",")), `mismatch for ${p}`);
    if (isSolvable(p, cols)) solvableCount++;
  }
  assert.equal(solvableCount, 12); // exactly half of all permutations are reachable
});

test("2x3 (even width) solvability rule matches BFS reachability for all 720 permutations", () => {
  const [cols, rows] = [2, 3];
  const seen = reachableStates(cols, rows);
  assert.equal(seen.size, 360); // 6!/2
  for (const p of permutations([1, 2, 3, 4, 5, 0])) {
    assert.equal(isSolvable(p, cols), seen.has(p.join(",")), `mismatch for ${p}`);
  }
});

test("3x2 (odd width) solvability rule matches BFS reachability for all 720 permutations", () => {
  const [cols, rows] = [3, 2];
  const seen = reachableStates(cols, rows);
  assert.equal(seen.size, 360); // 6!/2
  for (const p of permutations([1, 2, 3, 4, 5, 0])) {
    assert.equal(isSolvable(p, cols), seen.has(p.join(",")), `mismatch for ${p}`);
  }
});

test("tile movement rules on a 4x3 board", () => {
  const solved = createSolvedBoard(4, 3); // blank at index 11 (row 2, col 3)
  assert.ok(canMove(solved, 4, 3, 7));  // directly above the blank
  assert.ok(canMove(solved, 4, 3, 10)); // directly left of the blank
  assert.ok(!canMove(solved, 4, 3, 8)); // diagonal
  assert.ok(!canMove(solved, 4, 3, 6)); // two steps away
  assert.ok(!canMove(solved, 4, 3, 11)); // the blank itself
  assert.ok(!canMove(solved, 4, 3, -1));
  assert.ok(!canMove(solved, 4, 3, 99));
  assert.equal(moveTile(solved, 4, 3, 8), null); // illegal move rejected

  const moved = moveTile(solved, 4, 3, 10); // tile 11 moves right, blank to index 10
  assert.equal(moved[10], 0);
  assert.equal(moved[11], 11);
  assert.deepEqual(solved, createSolvedBoard(4, 3)); // original untouched

  // the top-left corner has only two neighbors
  assert.deepEqual(neighborIndices(0, 4, 3), [4, 1]);
});

test("shuffle: 1000 random 4x3 boards are solvable, valid and never pre-solved", () => {
  const seen = new Set();
  for (let i = 0; i < 1000; i++) {
    const board = shuffledBoard(4, 3, CONFIG.shuffleMoves, mulberry32(1000 + i));
    assert.equal(board.length, 12);
    assert.equal(board.filter((v) => v === 0).length, 1, "exactly one empty space");
    assert.deepEqual(
      board.filter((v) => v !== 0).sort((a, b) => a - b),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      "exactly the 11 tiles"
    );
    assert.ok(isSolvable(board, 4), "independent solvability check must pass");
    assert.ok(!isSolved(board, 4, 3), "board must not be already solved");
    seen.add(board.join(","));
  }
  assert.ok(seen.size > 950, `expected varied boards, got ${seen.size} distinct`);
});

test("shuffle: square and rectangular shapes from 2x2 to 6x5 always solvable", () => {
  const shapes = [[2, 2], [2, 3], [3, 2], [3, 3], [4, 3], [4, 4], [5, 4], [6, 5]];
  for (const [cols, rows] of shapes) {
    for (let i = 0; i < 200; i++) {
      const board = shuffledBoard(cols, rows, 250, mulberry32(cols * 100003 + rows * 1009 + i));
      assert.ok(isSolvable(board, cols), `${cols}x${rows} run ${i}`);
      assert.ok(!isSolved(board, cols, rows), `${cols}x${rows} run ${i}`);
    }
  }
});

test("shuffle: boards are well mixed and require real gameplay (4x3)", () => {
  const solved = createSolvedBoard(4, 3);
  const runs = 300;
  let totalMisplaced = 0;
  let minMisplaced = 12;
  for (let i = 0; i < runs; i++) {
    const board = shuffledBoard(4, 3, CONFIG.shuffleMoves, mulberry32(777000 + i));
    const misplaced = board.filter((v, idx) => v !== 0 && v !== solved[idx]).length;
    totalMisplaced += misplaced;
    minMisplaced = Math.min(minMisplaced, misplaced);
  }
  const average = totalMisplaced / runs;
  assert.ok(minMisplaced >= 4, `least-mixed board had only ${minMisplaced} misplaced tiles`);
  assert.ok(average > 8, `average misplaced tiles (${average.toFixed(2)}) too low`);
});

test("every shuffled 4x3 board can be solved by replaying inverse moves", () => {
  const [cols, rows] = [4, 3];
  for (let i = 0; i < 200; i++) {
    const rng = mulberry32(42000 + i);
    let board = createSolvedBoard(cols, rows);
    let blank = board.indexOf(0);
    let previous = -1;
    const previousBlanks = [];
    for (let m = 0; m < CONFIG.shuffleMoves; m++) {
      const options = neighborIndices(blank, cols, rows).filter((n) => n !== previous);
      const pick = options[Math.floor(rng() * options.length)];
      board = moveTile(board, cols, rows, pick);
      assert.ok(board, "walk step must be a legal move");
      previousBlanks.push(blank);
      previous = blank;
      blank = pick;
    }
    // undo every move in reverse order; the board must return to solved
    for (let k = previousBlanks.length - 1; k >= 0; k--) {
      board = moveTile(board, cols, rows, previousBlanks[k]);
      assert.ok(board, "inverse move must be legal");
    }
    assert.ok(isSolved(board, cols, rows), `run ${i}: replay must reach the solved state`);
  }
});

test("shuffle: rejects invalid arguments", () => {
  assert.throws(() => shuffledBoard(1, 3, 250), /cols/);
  assert.throws(() => shuffledBoard(4, 0, 250), /rows/);
  assert.throws(() => shuffledBoard(4.5, 3, 250), /cols/);
  assert.throws(() => shuffledBoard(4, 3, 0), /moves/);
  assert.throws(() => shuffledBoard(4, 3, "250"), /moves/);
});

test("config validation accepts the shipped configuration", () => {
  const validated = validateConfig(CONFIG);
  assert.equal(validated.boardCols, 4);
  assert.equal(validated.boardRows, 3);
  assert.equal(validated.shuffleMoves, 250);
  assert.equal(validated.games.length, 4);
  const passwords = new Set();
  for (const game of validated.games) {
    assert.ok(game.id.length > 0);
    assert.match(game.password, /^[A-Z]{4}$/);
    assert.ok(game.image.endsWith(".jpg") || game.image.endsWith(".png"));
    assert.ok(game.answer.length > 0);
    assert.ok(!passwords.has(game.password), "passwords must be unique");
    passwords.add(game.password);
    // the shipped image must actually exist in the repository
    assert.ok(existsSync(join(ROOT, game.image)), `missing image file: ${game.image}`);
  }
  assert.deepEqual(
    validated.games.map((g) => g.password),
    ["QJRW", "ZMKU", "NJBY", "HSXE"]
  );
  assert.deepEqual(
    validated.games.map((g) => g.answer),
    ["Maze 1 - Start: Π", "Maze 1 - End: Η", "Maze 2 - Start: Π", "Maze 2 - End: Φ"]
  );
});

test("config validation rejects invalid configurations", () => {
  const base = structuredClone(CONFIG);
  assert.doesNotThrow(() => validateConfig(base));

  // boardCols without boardRows (and vice versa)
  const halfRect = structuredClone(base);
  delete halfRect.boardRows;
  assert.throws(() => validateConfig(halfRect), /boardCols and boardRows/);
  const halfRect2 = structuredClone(base);
  delete halfRect2.boardCols;
  assert.throws(() => validateConfig(halfRect2), /boardCols and boardRows/);

  // both modes at once
  const both = structuredClone(base);
  both.boardSize = 4;
  assert.throws(() => validateConfig(both), /not both/);

  // no board size at all
  const none = structuredClone(base);
  delete none.boardCols;
  delete none.boardRows;
  assert.throws(() => validateConfig(none), /Missing board size/);

  // out-of-range rectangular sizes
  const tooBig = structuredClone(base);
  tooBig.boardCols = 13;
  assert.throws(() => validateConfig(tooBig), /boardCols/);
  const tooSmall = structuredClone(base);
  tooSmall.boardRows = 1;
  assert.throws(() => validateConfig(tooSmall), /boardRows/);
  const fractional = structuredClone(base);
  fractional.boardCols = 3.5;
  assert.throws(() => validateConfig(fractional), /boardCols/);

  // square shorthand still works and validates
  const square = structuredClone(base);
  delete square.boardCols;
  delete square.boardRows;
  square.boardSize = 5;
  assert.deepEqual(validateConfig(square), validatedShape(5, square.shuffleMoves, square));

  // duplicate password, even with different letter case
  const dupPassword = structuredClone(base);
  dupPassword.games[1].password = dupPassword.games[0].password.toLowerCase();
  assert.throws(() => validateConfig(dupPassword), /more than once/);

  // duplicate id
  const dupId = structuredClone(base);
  dupId.games[1].id = dupId.games[0].id;
  assert.throws(() => validateConfig(dupId), /more than once/);

  // invalid shuffle moves
  for (const bad of [0, -5, 2.5, "250", null]) {
    const c = structuredClone(base);
    c.shuffleMoves = bad;
    assert.throws(() => validateConfig(c), /shuffleMoves/);
  }

  // empty games list
  const noGames = structuredClone(base);
  noGames.games = [];
  assert.throws(() => validateConfig(noGames), /games/);

  // missing fields
  const missingAnswer = structuredClone(base);
  delete missingAnswer.games[2].answer;
  assert.throws(() => validateConfig(missingAnswer), /answer/);

  const missingImage = structuredClone(base);
  missingImage.games[0].image = "";
  assert.throws(() => validateConfig(missingImage), /image/);

  const missingId = structuredClone(base);
  missingId.games[3].id = "  ";
  assert.throws(() => validateConfig(missingId), /id/);

  // invalid passwords
  const badPassword = structuredClone(base);
  badPassword.games[0].password = "QJRW1";
  assert.throws(() => validateConfig(badPassword), /password/);

  const shortPassword = structuredClone(base);
  shortPassword.games[0].password = "QJ";
  assert.throws(() => validateConfig(shortPassword), /password/);

  const digitsPassword = structuredClone(base);
  digitsPassword.games[0].password = "QJR0";
  assert.throws(() => validateConfig(digitsPassword), /password/);
});

/** expected validateConfig() shape for a square shorthand config */
function validatedShape(size, shuffleMoves, cfg) {
  return {
    boardCols: size,
    boardRows: size,
    shuffleMoves,
    games: cfg.games,
  };
}

test("config file only uses relative asset paths (GitHub Pages subpath safe)", () => {
  const source = readFileSync(join(ROOT, "config.js"), "utf8");
  for (const match of source.matchAll(/image:\s*"([^"]+)"/g)) {
    assert.match(match[1], /^\.\/assets\//, "image paths must be relative");
  }
});
