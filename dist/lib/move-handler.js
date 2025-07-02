"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMove = handleMove;
const state_manager_1 = require("./state-manager");
const chess_js_1 = require("chess.js");
const prisma_1 = require("./prisma");
const utils_1 = require("./utils");
const game_1 = require("../types/game");
async function handleMove(state, socket, move) {
    if (!(0, state_manager_1.validateAuthentication)(socket))
        return;
    const playerId = socket.toString();
    if (!(0, state_manager_1.checkRateLimit)(state_manager_1.moveRateLimit, playerId, state_manager_1.MOVE_RATE_LIMIT_MS)) {
        (0, utils_1.safeSend)(socket, {
            type: game_1.ERROR,
            payload: { message: "Move too fast. Please wait a moment." }
        });
        return;
    }
    const multiplayerGame = state.games.find(game => game.player1 === socket || game.player2 === socket);
    if (multiplayerGame) {
        await handleMultiplayerMove(state, multiplayerGame, socket, move);
        return;
    }
    const singlePlayerGame = state.singlePlayerGames.find(game => game.player === socket);
    if (singlePlayerGame) {
        handleSinglePlayerMove(singlePlayerGame, socket, move);
        return;
    }
    (0, utils_1.safeSend)(socket, {
        type: game_1.ERROR,
        payload: { message: "No active game found" }
    });
}
async function handleMultiplayerMove(state, game, socket, move) {
    const isPlayer1 = game.player1 === socket;
    const isPlayer2 = game.player2 === socket;
    if (!isPlayer1 && !isPlayer2) {
        (0, utils_1.safeSend)(socket, { type: game_1.ERROR, payload: { message: "You are not a player in this game" } });
        return;
    }
    if (!game.player1 || !game.player2) {
        (0, utils_1.safeSend)(socket, { type: game_1.ERROR, payload: { message: "Waiting for opponent to reconnect." } });
        return;
    }
    try {
        const currentTurn = game.board.turn() === 'w' ? 'white' : 'black';
        const playerColor = isPlayer1 ? 'white' : 'black';
        if (currentTurn !== playerColor) {
            (0, utils_1.safeSend)(socket, { type: game_1.ERROR, payload: { message: "Not your turn" } });
            return;
        }
        if (!validatePawnPromotion(game.board, move)) {
            (0, utils_1.safeSend)(socket, {
                type: game_1.ERROR,
                payload: { message: "Pawn promotion required! Please select Queen, Rook, Bishop, or Knight." }
            });
            return;
        }
        const testBoard = new chess_js_1.Chess(game.board.fen());
        const moveResult = testBoard.move(move);
        if (!moveResult) {
            (0, utils_1.safeSend)(socket, { type: game_1.ERROR, payload: { message: "Illegal move" } });
            return;
        }
        await executeMove(game, move, moveResult);
        const opponent = isPlayer1 ? game.player2 : game.player1;
        const moveMessage = { type: game_1.MOVE, payload: { move } };
        (0, utils_1.safeSend)(opponent, moveMessage);
        (0, utils_1.safeSend)(socket, moveMessage);
        await checkAndHandleGameOver(state, game);
    }
    catch (error) {
        console.error('Move processing error:', error);
        let errorMessage = "Invalid move";
        if (error instanceof Error) {
            if (error.message.includes('Invalid move')) {
                errorMessage = "That move is not allowed in chess";
            }
            else if (error.message.includes('promotion')) {
                errorMessage = "Please select a piece for pawn promotion (Queen, Rook, Bishop, or Knight)";
            }
            else if (error.message.includes('turn')) {
                errorMessage = "It's not your turn to move";
            }
            else if (error.message.includes('check')) {
                errorMessage = "You must move to get out of check";
            }
            else if (error.message.includes('database') || error.message.includes('transaction')) {
                errorMessage = "Game state error. Please try again.";
            }
        }
        (0, utils_1.safeSend)(socket, { type: game_1.ERROR, payload: { message: errorMessage } });
    }
}
function validatePawnPromotion(board, move) {
    const piece = board.get(move.from);
    const isPawn = piece?.type === 'p';
    const isLastRank = (piece?.color === 'w' && move.to[1] === '8') ||
        (piece?.color === 'b' && move.to[1] === '1');
    if (isPawn && isLastRank) {
        return move.promotion ? ['q', 'r', 'b', 'n'].includes(move.promotion) : false;
    }
    return true;
}
async function executeMove(game, move, moveResult) {
    await prisma_1.prisma.$transaction(async (tx) => {
        game.board.move(move);
        const moveNum = game.moveCount + 1;
        const san = moveResult.san;
        const fen = game.board.fen();
        await tx.move.create({
            data: {
                gameId: game.dbId,
                moveNum,
                from: move.from,
                to: move.to,
                san,
                fen
            }
        });
        game.moveCount = moveNum;
    });
}
async function checkAndHandleGameOver(state, game) {
    const gameOverResult = checkGameOver(game.board);
    if (!gameOverResult.isOver)
        return;
    const gameOverMessage = {
        type: game_1.GAME_OVER,
        payload: {
            winner: gameOverResult.winner,
            reason: gameOverResult.reason
        }
    };
    if (game.player1)
        (0, utils_1.safeSend)(game.player1, gameOverMessage);
    if (game.player2)
        (0, utils_1.safeSend)(game.player2, gameOverMessage);
    await prisma_1.prisma.game.update({
        where: { id: game.dbId },
        data: { status: 'COMPLETED' }
    });
    state.games = state.games.filter(g => g !== game);
}
function handleSinglePlayerMove(game, socket, move) {
    try {
        const piece = game.board.get(move.from);
        const isPawn = piece?.type === 'p';
        const isLastRank = (piece?.color === 'w' && move.to[1] === '8') ||
            (piece?.color === 'b' && move.to[1] === '1');
        if (isPawn && isLastRank) {
            if (!move.promotion || !['q', 'r', 'b', 'n'].includes(move.promotion)) {
                (0, utils_1.safeSend)(socket, {
                    type: game_1.ERROR,
                    payload: { message: "Pawn promotion required! Please select Queen, Rook, Bishop, or Knight." }
                });
                return;
            }
        }
        const legalMoves = game.board.moves({ square: move.from, verbose: true });
        const isLegalMove = legalMoves.some((legalMove) => legalMove.from === move.from && legalMove.to === move.to &&
            (!isPawn || !isLastRank || legalMove.promotion === move.promotion));
        if (!isLegalMove) {
            (0, utils_1.safeSend)(socket, { type: game_1.ERROR, payload: { message: "Illegal move" } });
            return;
        }
        game.board.move(move);
        (0, utils_1.safeSend)(socket, { type: game_1.MOVE, payload: { move } });
        const gameOverResult = checkGameOver(game.board);
        if (gameOverResult.isOver) {
            const gameOverMessage = {
                type: game_1.GAME_OVER,
                payload: {
                    winner: gameOverResult.winner,
                    reason: gameOverResult.reason
                }
            };
            (0, utils_1.safeSend)(game.player, gameOverMessage);
            // Remove game from single player games
            // Note: This should be handled by the calling function with proper state access
        }
    }
    catch (error) {
        console.error('Single player move error:', error);
        let errorMessage = "Invalid move";
        if (error instanceof Error) {
            if (error.message.includes('Invalid move')) {
                errorMessage = "That move is not allowed in chess";
            }
            else if (error.message.includes('promotion')) {
                errorMessage = "Please select a piece for pawn promotion (Queen, Rook, Bishop, or Knight)";
            }
            else if (error.message.includes('turn')) {
                errorMessage = "It's not your turn to move";
            }
            else if (error.message.includes('check')) {
                errorMessage = "You must move to get out of check";
            }
        }
        (0, utils_1.safeSend)(socket, { type: game_1.ERROR, payload: { message: errorMessage } });
    }
}
function checkGameOver(board) {
    if (board.isCheckmate()) {
        const winner = board.turn() === 'w' ? 'black' : 'white';
        return { isOver: true, winner, reason: 'checkmate' };
    }
    if (board.isDraw()) {
        if (board.isStalemate())
            return { isOver: true, winner: null, reason: 'stalemate' };
        if (board.isThreefoldRepetition())
            return { isOver: true, winner: null, reason: 'threefold_repetition' };
        if (board.isInsufficientMaterial())
            return { isOver: true, winner: null, reason: 'insufficient_material' };
        return { isOver: true, winner: null, reason: 'fifty_move_rule' };
    }
    return { isOver: false, winner: null, reason: '' };
}
//# sourceMappingURL=move-handler.js.map