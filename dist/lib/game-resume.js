"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resumeActiveGameForUser = resumeActiveGameForUser;
const chess_js_1 = require("chess.js");
const prisma_1 = require("./prisma");
const utils_1 = require("./utils");
const game_1 = require("../types/game");
const state_manager_1 = require("./state-manager");
// ... move all game resumption logic here ...
// Export all these functions 
async function resumeActiveGameForUser(state, ws) {
    if (!ws.userId)
        return;
    try {
        const dbGame = await prisma_1.prisma.game.findFirst({
            where: {
                status: 'ACTIVE',
                OR: [
                    { playerWhiteId: ws.userId },
                    { playerBlackId: ws.userId }
                ]
            }
        });
        if (!dbGame) {
            (0, utils_1.safeSend)(ws, { type: 'no_game_to_resume' });
            return;
        }
        await resumeGame(state, ws, dbGame);
    }
    catch (error) {
        // Handle error silently
    }
}
async function resumeGame(state, ws, dbGame) {
    try {
        const dbMoves = await prisma_1.prisma.move.findMany({
            where: { gameId: dbGame.id },
            orderBy: { moveNum: 'asc' }
        });
        const chess = new chess_js_1.Chess();
        const moveHistory = [];
        for (const dbMove of dbMoves) {
            try {
                const moveResult = chess.move({ from: dbMove.from, to: dbMove.to });
                if (!moveResult) {
                    console.error(`Invalid move in database: ${dbMove.from}-${dbMove.to}`);
                    throw new Error(`Invalid move found in database`);
                }
                moveHistory.push({
                    from: dbMove.from,
                    to: dbMove.to,
                    san: dbMove.san,
                    fen: dbMove.fen
                });
            }
            catch (error) {
                console.error('Error processing move from database:', error);
                throw new Error('Failed to reconstruct game from database');
            }
        }
        const isCurrentPlayerWhite = dbGame.playerWhiteId === ws.userId;
        const opponentUserId = isCurrentPlayerWhite ? dbGame.playerBlackId : dbGame.playerWhiteId;
        const opponentSocket = state.users.find(u => u.userId === opponentUserId);
        let inMemoryGame = state.games.find(g => g.dbId === dbGame.id);
        if (!inMemoryGame) {
            inMemoryGame = {
                player1: isCurrentPlayerWhite ? ws : (opponentSocket ?? null),
                player2: !isCurrentPlayerWhite ? ws : (opponentSocket ?? null),
                board: chess,
                startTime: dbGame.createdAt,
                moveCount: dbMoves.length,
                dbId: dbGame.id,
                waitingForOpponent: !opponentSocket
            };
            state.games.push(inMemoryGame);
        }
        else {
            if (isCurrentPlayerWhite) {
                inMemoryGame.player1 = ws;
            }
            else {
                inMemoryGame.player2 = ws;
            }
            inMemoryGame.waitingForOpponent = !opponentSocket;
        }
        if (state_manager_1.disconnectTimeouts.has(dbGame.id)) {
            clearTimeout(state_manager_1.disconnectTimeouts.get(dbGame.id));
            state_manager_1.disconnectTimeouts.delete(dbGame.id);
        }
        if (isCurrentPlayerWhite) {
            inMemoryGame.player1 = ws;
        }
        else {
            inMemoryGame.player2 = ws;
        }
        inMemoryGame.waitingForOpponent = !opponentSocket;
        if (opponentSocket?.readyState === 1) {
            (0, utils_1.safeSend)(opponentSocket, { type: 'opponent_reconnected' });
        }
        const playerColor = isCurrentPlayerWhite ? 'white' : 'black';
        (0, utils_1.safeSend)(ws, {
            type: 'resume_game',
            payload: {
                color: playerColor,
                fen: chess.fen(),
                moveHistory,
                opponentConnected: !!opponentSocket,
                waitingForOpponent: !opponentSocket
            }
        });
    }
    catch (error) {
        console.error('Error resuming game:', error);
        (0, utils_1.safeSend)(ws, {
            type: game_1.ERROR,
            payload: { message: 'Failed to resume game. Please try again.' }
        });
    }
}
//# sourceMappingURL=game-resume.js.map