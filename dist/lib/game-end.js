"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleEndGame = handleEndGame;
exports.cleanupAllTimeouts = cleanupAllTimeouts;
exports.handleCancelMatchmaking = handleCancelMatchmaking;
const state_manager_1 = require("./state-manager");
const prisma_1 = require("./prisma");
const utils_1 = require("./utils");
const game_1 = require("../types/game");
// ... move all game ending and cleanup logic here ...
// Export all these functions 
async function handleEndGame(state, socket) {
    if (!(0, state_manager_1.validateAuthentication)(socket))
        return;
    const gameIdx = state.games.findIndex(g => g.player1 === socket || g.player2 === socket);
    if (gameIdx === -1)
        return;
    const game = state.games[gameIdx];
    if (game.dbId) {
        await prisma_1.prisma.move.deleteMany({ where: { gameId: game.dbId } });
        await prisma_1.prisma.game.delete({ where: { id: game.dbId } });
    }
    state.games.splice(gameIdx, 1);
    const opponent = game.player1 === socket ? game.player2 : game.player1;
    if (opponent?.readyState === 1) {
        opponent.send(JSON.stringify({ type: 'opponent_left' }));
    }
}
function cleanupAllTimeouts() {
    for (const [gameId, timeout] of Array.from(state_manager_1.disconnectTimeouts.entries())) {
        clearTimeout(timeout);
    }
    state_manager_1.disconnectTimeouts.clear();
}
function handleCancelMatchmaking(state, socket) {
    if (!(0, state_manager_1.validateAuthentication)(socket))
        return;
    if (state.pendingUser === socket) {
        state.pendingUser = null;
        (0, utils_1.safeSend)(socket, { type: game_1.MATCHMAKING_CANCELLED });
    }
}
//# sourceMappingURL=game-end.js.map