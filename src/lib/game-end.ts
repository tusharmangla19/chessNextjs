import type { GameState, ServerWebSocket } from '../types/game';
import { validateAuthentication, disconnectTimeouts } from './state-manager';
import { prisma } from './prisma';
import { safeSend } from './utils';
import { MATCHMAKING_CANCELLED } from '../types/game';

// ... move all game ending and cleanup logic here ...
// Export all these functions 

export async function handleEndGame(state: GameState, socket: ServerWebSocket): Promise<void> {
    if (!validateAuthentication(socket)) return;
    const gameIdx = state.games.findIndex(g => g.player1 === socket || g.player2 === socket);
    if (gameIdx === -1) return;
    const game = state.games[gameIdx];
    if (game.dbId) {
        await prisma.move.deleteMany({ where: { gameId: game.dbId } });
        await prisma.game.delete({ where: { id: game.dbId } });
    }
    state.games.splice(gameIdx, 1);
    const opponent = game.player1 === socket ? game.player2 : game.player1;
    if (opponent?.readyState === 1) {
        opponent.send(JSON.stringify({ type: 'opponent_left' }));
    }
}

export function cleanupAllTimeouts(): void {
    for (const [gameId, timeout] of Array.from(disconnectTimeouts.entries())) {
        clearTimeout(timeout);
    }
    disconnectTimeouts.clear();
}

export function handleCancelMatchmaking(state: GameState, socket: ServerWebSocket): void {
    if (!validateAuthentication(socket)) return;
    if (state.pendingUser === socket) {
        state.pendingUser = null;
        safeSend(socket, { type: MATCHMAKING_CANCELLED });
    }
} 