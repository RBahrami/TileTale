/**
 * Central configuration for the sliding puzzle game.
 *
 * Everything game-specific lives here — you never need to touch the
 * application logic to add a puzzle, change a password, swap an image
 * or change the final answer.
 *
 * Note: passwords are a game-access mechanism, not a security feature.
 * This is a static, client-side application, so the configuration can be
 * inspected by any visitor.
 */
export const CONFIG = {
    // Board shape: boardCols x boardRows tiles.
    // 4x3 = 12 cells (11 tiles + 1 empty space). Any combination of
    // integers from 2 to 12 works; odd and even widths are both supported.
    // (For a square board you may instead set boardSize, e.g. boardSize: 4.)
    boardCols: 4,
    boardRows: 3,

    // How many random legal moves are used to scramble the board.
    // Higher = more mixed up. Boards are always solvable regardless of value.
    shuffleMoves: 250,

    // All playable puzzles. Each entry needs:
    //   id       unique identifier (shown in the game header)
    //   password exactly four letters A-Z, case-insensitive, must be unique
    //   image    path to the picture, relative to index.html
    //            (the image is scaled to fill the whole board, edge to edge)
    //   answer   revealed after the puzzle is solved (shown as written)
    games: [
        {
            id: "puzzle-1",
            password: "QJRW",
            image: "./assets/puzzle-1.jpg",
            answer: "Maze 1 - Start: Π"
        },
        {
            id: "puzzle-2",
            password: "ZMKU",
            image: "./assets/puzzle-2.jpg",
            answer: "Maze 1 - End: Η"
        },
        {
            id: "puzzle-3",
            password: "NJBY",
            image: "./assets/puzzle-3.jpg",
            answer: "Maze 2 - Start: Π"
        },
        {
            id: "puzzle-4",
            password: "HSXE",
            image: "./assets/puzzle-4.jpg",
            answer: "Maze 2 - End: Φ"
        }
    ]
};

/**
 * Validate CONFIG and return a normalized copy.
 * Throws an Error with a readable, line-per-problem message that the UI
 * displays when the page loads, so configuration mistakes are obvious.
 *
 * Board size may be given either as boardCols + boardRows (rectangular or
 * square) or as boardSize (square shorthand) — but not both.
 *
 * @param {*} config - the raw CONFIG object
 * @returns {{boardCols: number, boardRows: number, shuffleMoves: number,
 *   games: Array<{id: string, password: string, image: string, answer: string}>}}
 */
export function validateConfig(config) {
    const problems = [];

    if (!config || typeof config !== "object" || Array.isArray(config)) {
        throw new Error("CONFIG must be an object with board size, shuffleMoves and games.");
    }

    const { boardSize, boardCols, boardRows, shuffleMoves, games } = config;

    // ---- board size: rectangle (cols x rows) or square shorthand ----
    const hasCols = boardCols !== undefined;
    const hasRows = boardRows !== undefined;
    const hasSize = boardSize !== undefined;
    let cols = null;
    let rows = null;

    if (hasSize && (hasCols || hasRows)) {
        problems.push(
            "Specify the board size either as boardSize (square) or as boardCols + boardRows (rectangle) — not both."
        );
    } else if (hasCols || hasRows) {
        if (!hasCols || !hasRows) {
            problems.push("boardCols and boardRows must be provided together.");
        }
        if (!Number.isInteger(boardCols) || boardCols < 2 || boardCols > 12) {
            problems.push(
                `boardCols must be an integer between 2 and 12 (got ${JSON.stringify(boardCols)}).`
            );
        }
        if (!Number.isInteger(boardRows) || boardRows < 2 || boardRows > 12) {
            problems.push(
                `boardRows must be an integer between 2 and 12 (got ${JSON.stringify(boardRows)}).`
            );
        }
        if (
            Number.isInteger(boardCols) && boardCols >= 2 && boardCols <= 12 &&
            Number.isInteger(boardRows) && boardRows >= 2 && boardRows <= 12
        ) {
            cols = boardCols;
            rows = boardRows;
        }
    } else if (hasSize) {
        if (!Number.isInteger(boardSize) || boardSize < 2 || boardSize > 10) {
            problems.push(
                `boardSize must be an integer between 2 and 10 (got ${JSON.stringify(boardSize)}).`
            );
        } else {
            cols = boardSize;
            rows = boardSize;
        }
    } else {
        problems.push(
            "Missing board size: set boardCols + boardRows (rectangle) or boardSize (square)."
        );
    }

    if (!Number.isInteger(shuffleMoves) || shuffleMoves < 1) {
        problems.push(
            `shuffleMoves must be a positive integer (got ${JSON.stringify(shuffleMoves)}).`
        );
    }

    if (!Array.isArray(games) || games.length === 0) {
        problems.push("games must be a non-empty array of game objects.");
    }

    const normalizedGames = [];
    const seenIds = new Set();
    const seenPasswords = new Set();

    if (Array.isArray(games)) {
        games.forEach((game, i) => {
            const where = `games[${i}]`;
            if (!game || typeof game !== "object" || Array.isArray(game)) {
                problems.push(`${where} must be an object.`);
                return;
            }

            // id: non-empty and unique
            if (typeof game.id !== "string" || !game.id.trim()) {
                problems.push(`${where}.id must be a non-empty string.`);
            } else if (seenIds.has(game.id.trim())) {
                problems.push(`${where}.id "${game.id.trim()}" is used more than once. IDs must be unique.`);
            } else {
                seenIds.add(game.id.trim());
            }

            // password: exactly four letters A-Z (stored uppercase)
            const password =
                typeof game.password === "string" ? game.password.trim().toUpperCase() : "";
            if (!/^[A-Z]{4}$/.test(password)) {
                problems.push(
                    `${where}.password must be exactly four English letters A-Z (got ${JSON.stringify(
                        game.password ?? ""
                    )}).`
                );
            } else if (seenPasswords.has(password)) {
                problems.push(
                    `${where}.password "${password}" is used more than once. Passwords must be unique.`
                );
            } else {
                seenPasswords.add(password);
            }

            // image: non-empty path
            if (typeof game.image !== "string" || !game.image.trim()) {
                problems.push(`${where}.image must be a non-empty path string.`);
            }

            // answer: non-empty text (any content is allowed, shown as written)
            if (typeof game.answer !== "string" || !game.answer.trim()) {
                problems.push(`${where}.answer must be a non-empty string.`);
            }

            if (
                typeof game.id === "string" && game.id.trim() &&
                /^[A-Z]{4}$/.test(password) &&
                typeof game.image === "string" && game.image.trim() &&
                typeof game.answer === "string" && game.answer.trim()
            ) {
                normalizedGames.push({
                    id: game.id.trim(),
                    password,
                    image: game.image.trim(),
                    answer: game.answer.trim(),
                });
            }
        });
    }

    if (problems.length > 0) {
        throw new Error(
            "Invalid CONFIG in config.js:\n- " + problems.join("\n- ")
        );
    }

    return { boardCols: cols, boardRows: rows, shuffleMoves, games: normalizedGames };
}
