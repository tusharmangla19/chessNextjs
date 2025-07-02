import type { GameState, ServerWebSocket, Move, MultiplayerGame, SinglePlayerGame } from '../types/game';
import { moveRateLimit, checkRateLimit, validateAuthentication, MOVE_RATE_LIMIT_MS } from './state-manager';
import { Chess } from 'chess.js';
import { prisma } from './prisma';
import { safeSend } from './utils';
import { MOVE, ERROR, GAME_OVER } from '../types/game';
import { Prisma } from '@prisma/client';

export async function handleMove(state: GameState, socket: ServerWebSocket, move: Move): Promise<void> {
    if (!validateAuthentication(socket)) return;
    const playerId = socket.toString();
    if (!checkRateLimit(moveRateLimit, playerId, MOVE_RATE_LIMIT_MS)) {
        safeSend(socket, {
            type: ERROR,
            payload: { message: "Move too fast. Please wait a moment." }
        });
        return;
    }
    const multiplayerGame = state.games.find(game => 
        game.player1 === socket || game.player2 === socket
    );
    if (multiplayerGame) {
        await handleMultiplayerMove(state, multiplayerGame, socket, move);
        return;
    }
    const singlePlayerGame = state.singlePlayerGames.find(game => game.player === socket);
    if (singlePlayerGame) {
        handleSinglePlayerMove(singlePlayerGame, socket, move);
        return;
    }
    safeSend(socket, {
        type: ERROR,
        payload: { message: "No active game found" }
    });
}

async function handleMultiplayerMove(state: GameState, game: MultiplayerGame, socket: ServerWebSocket, move: Move): Promise<void> {
    const isPlayer1 = game.player1 === socket;
    const isPlayer2 = game.player2 === socket;
    if (!isPlayer1 && !isPlayer2) {
        safeSend(socket, { type: ERROR, payload: { message: "You are not a player in this game" } });
        return;
    }
    if (!game.player1 || !game.player2) {
        safeSend(socket, { type: ERROR, payload: { message: "Waiting for opponent to reconnect." } });
        return;
    }
    try {
        const currentTurn = game.board.turn() === 'w' ? 'white' : 'black';
        const playerColor = isPlayer1 ? 'white' : 'black';
        if (currentTurn !== playerColor) {
            safeSend(socket, { type: ERROR, payload: { message: "Not your turn" } });
            return;
        }
        if (!validatePawnPromotion(game.board, move)) {
            safeSend(socket, {
                type: ERROR,
                payload: { message: "Pawn promotion required! Please select Queen, Rook, Bishop, or Knight." }
            });
            return;
        }
        const testBoard = new Chess(game.board.fen());
        const moveResult = testBoard.move(move);
        if (!moveResult) {
            safeSend(socket, { type: ERROR, payload: { message: "Illegal move" } });
            return;
        }
        await executeMove(game, move, moveResult);
        const opponent = isPlayer1 ? game.player2 : game.player1;
        const moveMessage = { type: MOVE, payload: { move } };
        safeSend(opponent, moveMessage);
        safeSend(socket, moveMessage);
        await checkAndHandleGameOver(state, game);
    } catch (error) {
        console.error('Move processing error:', error);
        let errorMessage = "Invalid move";
        if (error instanceof Error) {
            if (error.message.includes('Invalid move')) {
                errorMessage = "That move is not allowed in chess";
            } else if (error.message.includes('promotion')) {
                errorMessage = "Please select a piece for pawn promotion (Queen, Rook, Bishop, or Knight)";
            } else if (error.message.includes('turn')) {
                errorMessage = "It's not your turn to move";
            } else if (error.message.includes('check')) {
                errorMessage = "You must move to get out of check";
            } else if (error.message.includes('database') || error.message.includes('transaction')) {
                errorMessage = "Game state error. Please try again.";
            }
        }
        safeSend(socket, { type: ERROR, payload: { message: errorMessage } });
    }
}

function validatePawnPromotion(board: Chess, move: Move): boolean {
    const piece = board.get(move.from as any);
    const isPawn = piece?.type === 'p';
    const isLastRank = (piece?.color === 'w' && move.to[1] === '8') || 
                      (piece?.color === 'b' && move.to[1] === '1');
    if (isPawn && isLastRank) {
        return move.promotion ? ['q','r','b','n'].includes(move.promotion) : false;
    }
    return true;
}

async function executeMove(game: MultiplayerGame, move: Move, moveResult: any): Promise<void> {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

async function checkAndHandleGameOver(state: GameState, game: MultiplayerGame): Promise<void> {
    const gameOverResult = checkGameOver(game.board);
    if (!gameOverResult.isOver) return;
    const gameOverMessage = {
        type: GAME_OVER,
        payload: { 
            winner: gameOverResult.winner,
            reason: gameOverResult.reason
        }
    };
    if (game.player1) safeSend(game.player1, gameOverMessage);
    if (game.player2) safeSend(game.player2, gameOverMessage);
    await prisma.game.update({
        where: { id: game.dbId },
        data: { status: 'COMPLETED' }
    });
    state.games = state.games.filter(g => g !== game);
}

function handleSinglePlayerMove(game: SinglePlayerGame, socket: ServerWebSocket, move: Move): void {
    try {
        const piece = game.board.get(move.from as any);
        const isPawn = piece?.type === 'p';
        const isLastRank = (piece?.color === 'w' && move.to[1] === '8') || 
                          (piece?.color === 'b' && move.to[1] === '1');
        if (isPawn && isLastRank) {
            if (!move.promotion || !['q','r','b','n'].includes(move.promotion)) {
                safeSend(socket, {
                    type: ERROR,
                    payload: { message: "Pawn promotion required! Please select Queen, Rook, Bishop, or Knight." }
                });
                return;
            }
        }
        const legalMoves = game.board.moves({ square: move.from as any, verbose: true });
        const isLegalMove = legalMoves.some((legalMove: any) => 
            legalMove.from === move.from && legalMove.to === move.to &&
            (!isPawn || !isLastRank || legalMove.promotion === move.promotion)
        );
        if (!isLegalMove) {
            safeSend(socket, { type: ERROR, payload: { message: "Illegal move" } });
            return;
        }
        game.board.move(move);
        safeSend(socket, { type: MOVE, payload: { move } });
        const gameOverResult = checkGameOver(game.board);
        if (gameOverResult.isOver) {
            const gameOverMessage = {
                type: GAME_OVER,
                payload: { 
                    winner: gameOverResult.winner,
                    reason: gameOverResult.reason
                }
            };
            safeSend(game.player, gameOverMessage);
            // Remove game from single player games
            // Note: This should be handled by the calling function with proper state access
        }
    } catch (error) {
        console.error('Single player move error:', error);
        let errorMessage = "Invalid move";
        if (error instanceof Error) {
            if (error.message.includes('Invalid move')) {
                errorMessage = "That move is not allowed in chess";
            } else if (error.message.includes('promotion')) {
                errorMessage = "Please select a piece for pawn promotion (Queen, Rook, Bishop, or Knight)";
            } else if (error.message.includes('turn')) {
                errorMessage = "It's not your turn to move";
            } else if (error.message.includes('check')) {
                errorMessage = "You must move to get out of check";
            }
        }
        safeSend(socket, { type: ERROR, payload: { message: errorMessage } });
    }
}

function checkGameOver(board: Chess): { isOver: boolean; winner: string | null; reason: string } {
    if (board.isCheckmate()) {
        const winner = board.turn() === 'w' ? 'black' : 'white';
        return { isOver: true, winner, reason: 'checkmate' };
    }
    if (board.isDraw()) {
        if (board.isStalemate()) return { isOver: true, winner: null, reason: 'stalemate' };
        if (board.isThreefoldRepetition()) return { isOver: true, winner: null, reason: 'threefold_repetition' };
        if (board.isInsufficientMaterial()) return { isOver: true, winner: null, reason: 'insufficient_material' };
        return { isOver: true, winner: null, reason: 'fifty_move_rule' };
    }
    return { isOver: false, winner: null, reason: '' };
} 
