import { Chess, Square, Move } from "chess.js";
/**
 * Get the square representation from board coordinates
 */
export declare const getSquareFromCoords: (row: number, col: number) => Square;
/**
 * Get board coordinates from square representation
 */
export declare const getCoordsFromSquare: (square: Square) => {
    row: number;
    col: number;
};
/**
 * Check if a move is a pawn promotion
 */
export declare const isPawnPromotion: (chess: Chess, from: Square, to: Square) => boolean;
/**
 * Get valid moves for a square
 */
export declare const getValidMoves: (chess: Chess, square: Square) => Move[];
/**
 * Check if a square is part of the last move
 */
export declare const isLastMoveSquare: (chess: Chess, square: Square) => boolean;
/**
 * Get the current turn as a string
 */
export declare const getCurrentTurn: (chess: Chess) => "white" | "black";
/**
 * Check if it's the player's turn
 */
export declare const isPlayerTurn: (chess: Chess, playerColor: "white" | "black" | null) => boolean;
/**
 * Check if a piece belongs to the player
 */
export declare const isPlayerPiece: (piece: any, playerColor: "white" | "black" | null) => boolean;
/**
 * Get piece image path
 */
export declare const getPieceImagePath: (piece: any) => string;
/**
 * Get square background color class
 */
export declare const getSquareBackgroundClass: (rowIndex: number, colIndex: number) => string;
/**
 * Get square size class based on video call state
 */
export declare const getSquareSizeClass: (isVideoCallActive: boolean) => string;
//# sourceMappingURL=chess-engine.d.ts.map