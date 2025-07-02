"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DISCONNECT_GRACE_MS = void 0;
exports.handlePlayerDisconnect = handlePlayerDisconnect;
exports.scheduleGameDeletion = scheduleGameDeletion;
exports.deleteGame = deleteGame;
const utils_1 = require("./utils");
const prisma_1 = require("./prisma");
const disconnectTimeouts = new Map();
exports.DISCONNECT_GRACE_MS = 1 * 60 * 1000; // 1 minute
function handlePlayerDisconnect(state, game, socket) {
    if (game.player1 === socket)
        game.player1 = null;
    if (game.player2 === socket)
        game.player2 = null;
    const opponent = game.player1 || game.player2;
    if (opponent?.readyState === 1) {
        try {
            (0, utils_1.safeSend)(opponent, {
                type: 'opponent_disconnected',
                payload: { gracePeriodMs: exports.DISCONNECT_GRACE_MS }
            });
        }
        catch { }
    }
    scheduleGameDeletion(state, game);
}
function scheduleGameDeletion(state, game) {
    if (disconnectTimeouts.has(game.dbId))
        return;
    const timeout = setTimeout(async () => {
        const currentGame = state.games.find(g => g.dbId === game.dbId);
        if (!currentGame)
            return;
        const player1Connected = currentGame.player1?.readyState === 1;
        const player2Connected = currentGame.player2?.readyState === 1;
        if (player1Connected && player2Connected) {
            disconnectTimeouts.delete(game.dbId);
            return;
        }
        await deleteGame(state, game);
    }, exports.DISCONNECT_GRACE_MS);
    disconnectTimeouts.set(game.dbId, timeout);
}
async function deleteGame(state, game) {
    const connectedPlayers = [game.player1, game.player2].filter(p => p?.readyState === 1);
    for (const player of connectedPlayers) {
        if (player) {
            try {
                (0, utils_1.safeSend)(player, {
                    type: 'game_ended_disconnect',
                    payload: { message: 'Game ended due to opponent disconnection' }
                });
            }
            catch { }
        }
    }
    try {
        await prisma_1.prisma.move.deleteMany({ where: { gameId: game.dbId } });
        await prisma_1.prisma.game.delete({ where: { id: game.dbId } });
    }
    catch { }
    state.games = state.games.filter(g => g.dbId !== game.dbId);
    disconnectTimeouts.delete(game.dbId);
}
//# sourceMappingURL=disconnect.js.map