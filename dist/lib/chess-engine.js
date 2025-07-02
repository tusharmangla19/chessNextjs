"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSquareSizeClass = exports.getSquareBackgroundClass = exports.getPieceImagePath = exports.isPlayerPiece = exports.isPlayerTurn = exports.getCurrentTurn = exports.isLastMoveSquare = exports.getValidMoves = exports.isPawnPromotion = exports.getCoordsFromSquare = exports.getSquareFromCoords = void 0;
/**
 * Get the square representation from board coordinates
 */
const getSquareFromCoords = (row, col) => {
    const file = String.fromCharCode(97 + col);
    const rank = 8 - row;
    return `${file}${rank}`;
};
exports.getSquareFromCoords = getSquareFromCoords;
/**
 * Get board coordinates from square representation
 */
const getCoordsFromSquare = (square) => {
    const file = square.charCodeAt(0) - 97;
    const rank = 8 - parseInt(square[1]);
    return { row: rank, col: file };
};
exports.getCoordsFromSquare = getCoordsFromSquare;
/**
 * Check if a move is a pawn promotion
 */
const isPawnPromotion = (chess, from, to) => {
    const piece = chess.get(from);
    if (!piece || piece.type !== 'p')
        return false;
    const isLastRank = (piece.color === 'w' && to[1] === '8') ||
        (piece.color === 'b' && to[1] === '1');
    return isLastRank;
};
exports.isPawnPromotion = isPawnPromotion;
/**
 * Get valid moves for a square
 */
const getValidMoves = (chess, square) => {
    try {
        return chess.moves({ square, verbose: true });
    }
    catch (error) {
        console.error("Error calculating moves for square:", square, error);
        return [];
    }
};
exports.getValidMoves = getValidMoves;
/**
 * Check if a square is part of the last move
 */
const isLastMoveSquare = (chess, square) => {
    const history = chess.history({ verbose: true });
    if (history.length === 0)
        return false;
    const lastMove = history[history.length - 1];
    return lastMove.from === square || lastMove.to === square;
};
exports.isLastMoveSquare = isLastMoveSquare;
/**
 * Get the current turn as a string
 */
const getCurrentTurn = (chess) => {
    return chess.turn() === 'w' ? 'white' : 'black';
};
exports.getCurrentTurn = getCurrentTurn;
/**
 * Check if it's the player's turn
 */
const isPlayerTurn = (chess, playerColor) => {
    if (!playerColor)
        return false;
    const currentTurn = (0, exports.getCurrentTurn)(chess);
    return playerColor === currentTurn;
};
exports.isPlayerTurn = isPlayerTurn;
/**
 * Check if a piece belongs to the player
 */
const isPlayerPiece = (piece, playerColor) => {
    if (!piece || !playerColor)
        return false;
    return (playerColor === 'white' && piece.color === 'w') ||
        (playerColor === 'black' && piece.color === 'b');
};
exports.isPlayerPiece = isPlayerPiece;
/**
 * Get piece image path
 */
const getPieceImagePath = (piece) => {
    const color = piece.color === "b" ? "" : " copy";
    const type = piece.type.toUpperCase();
    return `/${type}${color}.png`;
};
exports.getPieceImagePath = getPieceImagePath;
/**
 * Get square background color class
 */
const getSquareBackgroundClass = (rowIndex, colIndex) => {
    return (rowIndex + colIndex) % 2 === 0 ? 'bg-amber-100' : 'bg-amber-800';
};
exports.getSquareBackgroundClass = getSquareBackgroundClass;
/**
 * Get square size class based on video call state
 */
const getSquareSizeClass = (isVideoCallActive) => {
    if (isVideoCallActive) {
        return 'w-12 h-12 sm:w-16 sm:h-16';
    }
    return 'w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20';
};
exports.getSquareSizeClass = getSquareSizeClass;
//# sourceMappingURL=chess-engine.js.map