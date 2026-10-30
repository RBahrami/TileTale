/**
 * Sliding Puzzle — UI layer.
 *
 * Pure game logic lives in puzzle.js; all customization lives in config.js.
 * The app has three screens: password entry, game, and (on bad config) an
 * error screen — plus a completion modal shown when a puzzle is solved.
 */

import { CONFIG, validateConfig } from "./config.js";
import { isSolved, moveTile, shuffledBoard } from "./puzzle.js";

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
const restartBtn = $("restart-btn");
const backBtn = $("back-btn");

const modal = $("modal");
const modalAnswer = $("modal-answer");
const modalBackBtn = $("modal-back-btn");

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
    finished: false // true once solved; blocks all input and shows the modal
};

const tileElements = new Map(); // tile value -> element

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function showScreen(name) {
    passwordScreen.hidden = name !== "password";
    gameScreen.hidden = name !== "game";
    errorScreen.hidden = name !== "error";
    modal.hidden = true;
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
        return; // illegal move (not adjacent to the empty space)
    }
    state.board = next;
    state.moves += 1;
    updateMoveCounter();
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

// Arrow keys: the key names the direction the TILE moves.
// e.g. ArrowUp moves the tile that sits below the empty space upwards.
document.addEventListener("keydown", (event) => {
    if (gameScreen.hidden || !state.board) {
        return;
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
// Completion modal
// ---------------------------------------------------------------------------

function finishGame() {
    state.finished = true;
    modalAnswer.textContent = state.game.answer;
    modal.hidden = false;
    modalBackBtn.focus();
}

modalBackBtn.addEventListener("click", backToPassword);

// ---------------------------------------------------------------------------
// Returning to the password screen
// ---------------------------------------------------------------------------

backBtn.addEventListener("click", backToPassword);

function backToPassword() {
    state.game = null;
    state.image = null;
    state.board = null;
    state.finished = false;
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
};
