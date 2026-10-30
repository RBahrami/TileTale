/**
 * Sliding Puzzle — UI layer.
 *
 * Pure game logic lives in puzzle.js; all customization lives in config.js.
 * The app has three screens: password entry, game, and (on bad config) an
 * error screen. When a puzzle is solved the board reveals the complete
 * picture and the result is shown in a panel directly below it. The game
 * screen offers Undo (last 20 player moves) and a text-free visual hint
 * that explains the standard solving strategy.
 */

import { CONFIG, validateConfig } from "./config.js";
import { isSolved, moveTile, recordHistory, shuffledBoard, UNDO_LIMIT } from "./puzzle.js";

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);

const passwordScreen = $("screen-password");
const gameScreen = $("screen-game");
const errorScreen = $("screen-error");

const passwordForm = $("password-form");
const passwordInput = $("password-input");
const passwordSubmit = $("password-submit");
const passwordError = $("password-error");
const configErrorMessage = $("config-error-message");

const gameIdLabel = $("game-id");
const moveCounter = $("move-counter");
const board = $("board");
const controls = $("controls");
const undoBtn = $("undo-btn");
const restartBtn = $("restart-btn");
const hintBtn = $("hint-btn");
const backBtn = $("back-btn");

const resultPanel = $("result-panel");
const resultAnswer = $("result-answer");
const resultBackBtn = $("result-back-btn");
const hintEl = $("hint");

const hintModal = $("hint-modal");
const hintViewport = $("hint-viewport");
const hintTrack = $("hint-track");
const hintDots = $("hint-dots");
const hintPrevBtn = $("hint-prev");
const hintNextBtn = $("hint-next");
const hintCloseBtn = $("hint-close");

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------

const state = {
    config: null,   // validated configuration
    game: null,     // currently selected game entry
    image: null,    // preloaded HTMLImageElement for the current game
    board: null,    // flat array of numbers, 0 = empty space
    cols: 0,        // board width  (number of columns)
    rows: 0,        // board height (number of rows)
    moves: 0,
    history: [],    // snapshots of the board before each player move (undo)
    finished: false // true once solved; blocks input, reveals the result panel
};

const tileElements = new Map(); // tile value -> element

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function showScreen(name) {
    passwordScreen.hidden = name !== "password";
    gameScreen.hidden = name !== "game";
    errorScreen.hidden = name !== "error";
    resultPanel.hidden = true;
    hintModal.hidden = true;
}

function showMessage(el, text) {
    el.textContent = text;
    el.hidden = false;
    // restart the shake animation on repeated errors
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
}

function clearMessage(el) {
    el.hidden = true;
    el.textContent = "";
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Could not load image: ${src}`));
        image.src = src;
    });
}

// ---------------------------------------------------------------------------
// Password screen
// ---------------------------------------------------------------------------

passwordForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (passwordSubmit.disabled) {
        return; // a game is currently loading
    }
    const entered = passwordInput.value.trim().toUpperCase();
    const game = state.config.games.find((g) => g.password === entered);
    if (!game) {
        showMessage(passwordError, "Incorrect password. Please try again.");
        passwordInput.select();
        return;
    }
    clearMessage(passwordError);
    void startGame(game);
});

async function startGame(game) {
    passwordSubmit.disabled = true;
    let image;
    try {
        image = await loadImage(game.image);
    } catch {
        showMessage(
            passwordError,
            `Could not load the puzzle image for "${game.id}" (${game.image}). ` +
            "Check that the file exists and that the path in config.js is correct."
        );
        return;
    } finally {
        passwordSubmit.disabled = false;
    }

    state.game = game;
    state.image = image;
    state.cols = state.config.boardCols;
    state.rows = state.config.boardRows;
    startRound();
    gameIdLabel.textContent = game.id;
    showScreen("game");
    layoutTiles(); // the board just became visible; size it now
}

// ---------------------------------------------------------------------------
// Game screen
// ---------------------------------------------------------------------------

function startRound() {
    state.board = shuffledBoard(
        state.config.boardCols,
        state.config.boardRows,
        state.config.shuffleMoves
    );
    state.moves = 0;
    state.finished = false;
    state.history = []; // a fresh shuffle has no player moves to undo
    board.classList.remove("solved");
    resultPanel.hidden = true;
    controls.hidden = false;
    hintEl.hidden = false;
    updateUndoButton();
    buildBoard();
    updateMoveCounter();
}

function buildBoard() {
    tileElements.clear();
    board.innerHTML = "";
    board.style.setProperty("--cols", String(state.cols));
    board.style.setProperty("--rows", String(state.rows));
    board.style.aspectRatio = `${state.cols} / ${state.rows}`;

    for (let value = 1; value < state.cols * state.rows; value++) {
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = "tile";
        tile.dataset.value = String(value);
        tile.setAttribute("aria-label", `Tile ${value}`);

        const badge = document.createElement("span");
        badge.className = "tile-num";
        badge.textContent = String(value);
        tile.appendChild(badge);

        tileElements.set(value, tile);
        board.appendChild(tile);
    }

    // Completion reveal: this layer fades in over the board the moment the
    // puzzle is solved, filling the empty cell and sealing the gaps so the
    // complete picture is displayed.
    const reveal = document.createElement("div");
    reveal.className = "board-reveal";
    reveal.setAttribute("aria-hidden", "true");
    reveal.style.backgroundImage = `url("${state.game.image}")`;
    board.appendChild(reveal);

    renderTiles();
}

/** Position every tile (percentage transforms — resolution independent). */
function renderTiles() {
    for (const [value, tile] of tileElements) {
        const index = state.board.indexOf(value);
        const row = Math.floor(index / state.cols);
        const col = index % state.cols;
        tile.style.transform =
            `translate(calc(${col} * (100% + var(--gap))), calc(${row} * (100% + var(--gap))))`;
    }
}

/**
 * Give every tile its slice of the board image.
 *
 * The image is scaled to FILL the whole board, edge to edge (stretched or
 * shrunk independently in both directions to match the board shape), so
 * every tile is completely covered and no letterbox is visible. Each tile
 * shows exactly the part of the stretched picture that sits under its cell,
 * so the completed board reproduces the full image.
 */
function layoutTiles() {
    if (!state.game || !state.image || !board.clientWidth) {
        return;
    }
    const cols = state.cols;
    const rows = state.rows;
    const boardWidth = board.clientWidth;
    const boardHeight = board.clientHeight;
    const gap = parseFloat(getComputedStyle(board).getPropertyValue("--gap")) || 0;
    const tileWidth = (boardWidth - (cols - 1) * gap) / cols;
    const tileHeight = (boardHeight - (rows - 1) * gap) / rows;

    for (const [value, tile] of tileElements) {
        const home = value - 1;
        const row = Math.floor(home / cols);
        const col = home % cols;
        tile.style.backgroundImage = `url("${state.game.image}")`;
        tile.style.backgroundSize = `${boardWidth}px ${boardHeight}px`;
        tile.style.backgroundPosition =
            `-${col * (tileWidth + gap)}px -${row * (tileHeight + gap)}px`;
    }
}

new ResizeObserver(layoutTiles).observe(board);

function updateMoveCounter() {
    moveCounter.textContent = String(state.moves);
}

function tryMove(index) {
    if (state.finished || !state.board) {
        return; // no moves after completion
    }
    const next = moveTile(state.board, state.cols, state.rows, index);
    if (!next) {
        return; // illegal move (not adjacent to the empty space) — never recorded
    }
    state.history = recordHistory(state.history, state.board, UNDO_LIMIT); // state BEFORE the move
    state.board = next;
    state.moves += 1;
    updateMoveCounter();
    updateUndoButton();
    renderTiles();
    if (isSolved(state.board, state.cols, state.rows)) {
        finishGame();
    }
}

board.addEventListener("click", (event) => {
    const tile = event.target.closest(".tile");
    if (!tile) {
        return;
    }
    tryMove(state.board.indexOf(Number(tile.dataset.value)));
});

// ---------------------------------------------------------------------------
// Undo — restores the exact board state before the last player move
// ---------------------------------------------------------------------------

function updateUndoButton() {
    undoBtn.disabled = state.history.length === 0;
}

function undoMove() {
    if (state.finished || state.history.length === 0) {
        return; // nothing to undo; undoing never creates history entries
    }
    state.board = state.history.pop();
    state.moves -= 1;
    updateMoveCounter();
    updateUndoButton();
    renderTiles();
}

undoBtn.addEventListener("click", undoMove);

// Arrow keys: the key names the direction the TILE moves.
// e.g. ArrowUp moves the tile that sits below the empty space upwards.
document.addEventListener("keydown", (event) => {
    if (!hintModal.hidden) {
        // While the hint is open, arrows navigate its stages and Escape
        // closes it — they never move tiles on the board behind it.
        if (event.key === "Escape") {
            closeHint();
        } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            showHintStage(hintStage - 1);
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            showHintStage(hintStage + 1);
        }
        return;
    }
    if (gameScreen.hidden || !state.board) {
        return;
    }
    if (state.finished) {
        return; // puzzle solved: leave the arrow keys to normal page scrolling
    }
    const cols = state.cols;
    const rows = state.rows;
    const blank = state.board.indexOf(0);
    const blankRow = Math.floor(blank / cols);
    const blankCol = blank % cols;
    let target = -1;
    switch (event.key) {
        case "ArrowUp":
            if (blankRow + 1 < rows) target = blank + cols;
            break;
        case "ArrowDown":
            if (blankRow - 1 >= 0) target = blank - cols;
            break;
        case "ArrowLeft":
            if (blankCol + 1 < cols) target = blank + 1;
            break;
        case "ArrowRight":
            if (blankCol - 1 >= 0) target = blank - 1;
            break;
        default:
            return;
    }
    event.preventDefault();
    tryMove(target);
});

restartBtn.addEventListener("click", () => {
    startRound();
    layoutTiles();
});

// ---------------------------------------------------------------------------
// Completion: reveal the full picture, show the result below the board
// ---------------------------------------------------------------------------

function finishGame() {
    state.finished = true;
    // The empty cell fills in and the gaps seal (CSS transition), so the
    // complete picture stays visible on the board. The result then appears
    // as a panel below the image — never on top of it.
    board.classList.add("solved");
    controls.hidden = true; // undo/restart/hint are not needed after completion
    hintEl.hidden = true;
    resultAnswer.textContent = state.game.answer;
    resultPanel.hidden = false;
    requestAnimationFrame(() => {
        resultBackBtn.focus({ preventScroll: true });
        resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
}

resultBackBtn.addEventListener("click", backToPassword);

// ---------------------------------------------------------------------------
// Hint — a text-free, visual guide to the standard solving strategy.
// Purely presentational: it never touches the board, move counter or history.
// Four schematic 4x3 stages: (1) first row — 1 & 2 done, 3 & 4 as a pair;
// (2) first remaining column — 5 & 9 as a pair; (3) second remaining column —
// 6 & 10 as a pair; (4) the final bottom-right 2x2 (7, 8, 11 + empty).
// ---------------------------------------------------------------------------

const HINT_COLS = 4;
const HINT_ROWS = 3;

const HINT_STAGE_DEFS = [
    { done: [1, 2], group: [3, 4], rings: [{ cells: [3, 4], style: "group" }, { cells: [1, 2, 3, 4], style: "section" }] },
    { done: [1, 2, 3, 4], group: [5, 9], rings: [{ cells: [5, 9], style: "group" }] },
    { done: [1, 2, 3, 4, 5, 9], group: [6, 10], rings: [{ cells: [6, 10], style: "group" }] },
    { done: [1, 2, 3, 4, 5, 6, 9, 10], group: [7, 8, 11], rings: [{ cells: [7, 8, 11, 0], style: "group" }] },
];

let hintStage = 0;

/** 1-based grid cell of a tile value in the solved guide board (0 = empty). */
function hintCell(value) {
    const home = value === 0 ? HINT_COLS * HINT_ROWS - 1 : value - 1;
    return { row: Math.floor(home / HINT_COLS) + 1, col: (home % HINT_COLS) + 1 };
}

function buildHintBoards() {
    HINT_STAGE_DEFS.forEach((def, stageIndex) => {
        const stage = document.createElement("div");
        stage.className = "h-stage";
        stage.dataset.stage = String(stageIndex + 1);

        const board = document.createElement("div");
        board.className = "h-board";
        board.dataset.stage = String(stageIndex + 1);

        // numbered tiles 1..11 in reading order ...
        for (let value = 1; value <= HINT_COLS * HINT_ROWS - 1; value++) {
            const tile = document.createElement("div");
            tile.className = "h-tile";
            if (def.done.includes(value)) {
                tile.classList.add("h-done");
            }
            if (def.group.includes(value)) {
                tile.classList.add("h-group");
            }
            tile.textContent = String(value);
            const cell = hintCell(value);
            tile.style.gridRow = String(cell.row);
            tile.style.gridColumn = String(cell.col);
            board.appendChild(tile);
        }

        // ... and the visually distinct empty cell
        const empty = document.createElement("div");
        empty.className = "h-empty";
        const emptyCell = hintCell(0);
        empty.style.gridRow = String(emptyCell.row);
        empty.style.gridColumn = String(emptyCell.col);
        board.appendChild(empty);

        // grouping / section rings
        for (const ring of def.rings) {
            const cells = ring.cells.map(hintCell);
            const r1 = Math.min(...cells.map((c) => c.row));
            const r2 = Math.max(...cells.map((c) => c.row));
            const c1 = Math.min(...cells.map((c) => c.col));
            const c2 = Math.max(...cells.map((c) => c.col));
            const el = document.createElement("div");
            el.className = `h-ring h-ring-${ring.style}`;
            el.dataset.ring = ring.style;
            el.style.gridRow = `${r1} / ${r2 + 1}`;
            el.style.gridColumn = `${c1} / ${c2 + 1}`;
            board.appendChild(el);
        }

        stage.appendChild(board);
        hintTrack.appendChild(stage);

        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "hint-dot";
        dot.dataset.index = String(stageIndex);
        dot.setAttribute("aria-label", `Stage ${stageIndex + 1}`);
        dot.addEventListener("click", () => showHintStage(stageIndex));
        hintDots.appendChild(dot);
    });
    showHintStage(0);
}

function showHintStage(index) {
    const last = HINT_STAGE_DEFS.length - 1;
    hintStage = Math.max(0, Math.min(last, index));
    hintTrack.style.transform = `translateX(-${hintStage * 100}%)`;
    hintPrevBtn.disabled = hintStage === 0;
    hintNextBtn.disabled = hintStage === last;
    [...hintDots.children].forEach((dot, i) => {
        dot.classList.toggle("active", i === hintStage);
    });
}

function openHint() {
    showHintStage(0);
    hintModal.hidden = false;
    hintCloseBtn.focus({ preventScroll: true });
}

function closeHint() {
    hintModal.hidden = true;
    hintBtn.focus({ preventScroll: true });
}

hintBtn.addEventListener("click", openHint);
hintCloseBtn.addEventListener("click", closeHint);
hintPrevBtn.addEventListener("click", () => showHintStage(hintStage - 1));
hintNextBtn.addEventListener("click", () => showHintStage(hintStage + 1));

// clicking the dark backdrop closes the guide
hintModal.addEventListener("click", (event) => {
    if (event.target === hintModal) {
        closeHint();
    }
});

// swipe navigation (pointer events cover touch and mouse)
let hintPointerStartX = null;
hintViewport.addEventListener("pointerdown", (event) => {
    hintPointerStartX = event.clientX;
});
hintViewport.addEventListener("pointerup", (event) => {
    if (hintPointerStartX === null) {
        return;
    }
    const dx = event.clientX - hintPointerStartX;
    hintPointerStartX = null;
    if (Math.abs(dx) > 40) {
        showHintStage(hintStage + (dx < 0 ? 1 : -1));
    }
});
hintViewport.addEventListener("pointercancel", () => {
    hintPointerStartX = null;
});

// ---------------------------------------------------------------------------
// Returning to the password screen
// ---------------------------------------------------------------------------

backBtn.addEventListener("click", backToPassword);

function backToPassword() {
    state.game = null;
    state.image = null;
    state.board = null;
    state.finished = false;
    state.history = []; // starting another game clears the previous history
    tileElements.clear();
    board.innerHTML = "";
    passwordForm.reset();
    clearMessage(passwordError);
    showScreen("password");
    passwordInput.focus();
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

function init() {
    try {
        state.config = validateConfig(CONFIG);
    } catch (error) {
        configErrorMessage.textContent = error.message;
        showScreen("error");
        return;
    }
    buildHintBoards(); // static, text-free strategy guide
    showScreen("password");
    passwordInput.focus();
}

init();

// Small hook for automated tests / debugging. Not used by normal gameplay.
window.__puzzle = {
    state: () => ({
        board: state.board ? [...state.board] : null,
        moves: state.moves,
        finished: state.finished,
        gameId: state.game ? state.game.id : null,
        cols: state.cols,
        rows: state.rows,
        historyLength: state.history.length,
    }),
    setBoard(next) {
        if (!state.game || state.finished || !Array.isArray(next)) {
            return false;
        }
        if (next.length !== state.cols * state.rows) {
            return false;
        }
        state.board = [...next];
        renderTiles();
        if (isSolved(state.board, state.cols, state.rows)) {
            finishGame();
        }
        return true;
    },
    undo() {
        undoMove();
        return state.history.length;
    },
};
