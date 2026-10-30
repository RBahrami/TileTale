/**
 * Sliding puzzle — pure game logic, no DOM access.
 *
 * The board is a flat array of `cols * rows` numbers.
 * Tile values are 1 .. cols*rows-1 and the empty space is 0.
 * Index i maps to row Math.floor(i / cols), column i % cols.
 *
 * The solved 4x3 board (4 columns, 3 rows) looks like:
 *
 *    1  2  3  4
 *    5  6  7  8
 *    9 10 11  0
 *
 * Both square and rectangular boards are supported. The solvability rule
 * depends only on the board WIDTH (number of columns).
 */

/** The solved board for a cols x rows grid. */
export function createSolvedBoard(cols, rows) {
    if (!Number.isInteger(cols) || cols < 1 || !Number.isInteger(rows) || rows < 1) {
        throw new Error(`cols and rows must be integers >= 1 (got ${JSON.stringify(cols)}, ${JSON.stringify(rows)})`);
    }
    const board = [];
    for (let value = 1; value < cols * rows; value++) {
        board.push(value);
    }
    board.push(0);
    return board;
}

/** True when the board is in the solved state. */
export function isSolved(board, cols, rows) {
    if (!Array.isArray(board) || board.length !== cols * rows) {
        return false;
    }
    return board.every((value, index) => value === (index + 1) % (cols * rows));
}

/**
 * Count inversions: pairs of tiles (ignoring the empty space) where a larger
 * tile appears before a smaller one when reading left-to-right, top-to-bottom.
 */
export function countInversions(board) {
    const tiles = board.filter((value) => value !== 0);
    let inversions = 0;
    for (let i = 0; i < tiles.length; i++) {
        for (let j = i + 1; j < tiles.length; j++) {
            if (tiles[i] > tiles[j]) {
                inversions++;
            }
        }
    }
    return inversions;
}

/**
 * The empty space's row counted from the bottom, starting at 1 for the
 * bottom row of the board.
 */
export function blankRowFromBottom(board, cols) {
    const rows = board.length / cols;
    const blankRowFromTop = Math.floor(board.indexOf(0) / cols);
    return rows - blankRowFromTop;
}

/**
 * Independent solvability check, using the generalized rule that covers
 * odd and even board widths (only the width matters):
 *
 *  - Odd width (e.g. 3x3, 3x2):  solvable  <=>  inversion count is even.
 *  - Even width (e.g. 4x4, 4x3): solvable  <=>  inversions + blank row counted
 *    from the bottom (1-based) is odd.
 *
 * The solved 4x3 board (0 inversions, blank on the bottom row) satisfies
 * (0 + 1) % 2 === 1, as required.
 */
export function isSolvable(board, cols) {
    if (!Array.isArray(board) || !Number.isInteger(cols) || cols < 2) {
        return false;
    }
    if (board.length < cols || board.length % cols !== 0) {
        return false;
    }
    const inversions = countInversions(board);
    if (cols % 2 === 1) {
        return inversions % 2 === 0;
    }
    return (inversions + blankRowFromBottom(board, cols)) % 2 === 1;
}

/** Indices of the cells orthogonally adjacent to `index` (no diagonals). */
export function neighborIndices(index, cols, rows) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const neighbors = [];
    if (row > 0) neighbors.push(index - cols);        // above
    if (row < rows - 1) neighbors.push(index + cols); // below
    if (col > 0) neighbors.push(index - 1);           // left
    if (col < cols - 1) neighbors.push(index + 1);    // right
    return neighbors;
}

/** True when the tile at `index` is orthogonally adjacent to the empty space. */
export function canMove(board, cols, rows, index) {
    if (!Number.isInteger(index) || index < 0 || index >= board.length) {
        return false;
    }
    const blank = board.indexOf(0);
    if (index === blank) {
        return false;
    }
    return neighborIndices(blank, cols, rows).includes(index);
}

/**
 * Move the tile at `index` into the empty space. Diagonal or distant moves
 * are rejected. Returns a NEW board array, or null when the move is illegal.
 */
export function moveTile(board, cols, rows, index) {
    if (!canMove(board, cols, rows, index)) {
        return null;
    }
    const next = board.slice();
    const blank = next.indexOf(0);
    next[blank] = next[index];
    next[index] = 0;
    return next;
}

/**
 * Scramble the board with `moves` random LEGAL moves starting from the
 * solved state, never immediately undoing the previous move.
 *
 * Because every step is a valid sliding move applied to a reachable state,
 * the result is mathematically guaranteed to be solvable — no random
 * permutation is ever used. As defense in depth, the result is additionally
 * checked with isSolvable() and re-shuffled if it ever failed, and boards
 * that end up already solved are regenerated.
 *
 * @param {number} cols  board width (>= 2)
 * @param {number} rows  board height (>= 2)
 * @param {number} moves number of random legal moves (>= 1)
 * @param {() => number} rng random source in [0, 1); defaults to Math.random
 * @returns {number[]} a solvable, non-solved board
 */
export function shuffledBoard(cols, rows, moves, rng = Math.random) {
    if (!Number.isInteger(cols) || cols < 2 || !Number.isInteger(rows) || rows < 2) {
        throw new Error(`cols and rows must be integers >= 2 (got ${JSON.stringify(cols)}, ${JSON.stringify(rows)})`);
    }
    if (!Number.isInteger(moves) || moves < 1) {
        throw new Error(`moves must be an integer >= 1 (got ${JSON.stringify(moves)})`);
    }

    for (;;) {
        let board = createSolvedBoard(cols, rows);
        let blank = board.indexOf(0);
        let previous = -1;

        for (let step = 0; step < moves; step++) {
            const options = neighborIndices(blank, cols, rows).filter((n) => n !== previous);
            const pick = options[Math.floor(rng() * options.length)];
            board[blank] = board[pick];
            board[pick] = 0;
            previous = blank;
            blank = pick;
        }

        if (!isSolved(board, cols, rows) && isSolvable(board, cols)) {
            return board;
        }
        // otherwise: discard and generate another one
    }
}
