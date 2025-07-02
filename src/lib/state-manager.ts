import { Chess } from 'chess.js';
import type { ServerWebSocket, WebSocketWithUserId, GameState, MultiplayerGame, SinglePlayerGame, GameRoom, Move, VideoCallMessage, VideoCall } from '../types/game';
import { prisma } from './prisma';
import { safeSend } from './utils';
import { INIT_GAME, MOVE, GAME_OVER, ERROR, SINGLE_PLAYER, CREATE_ROOM, JOIN_ROOM, ROOM_CREATED, ROOM_JOINED, ROOM_NOT_FOUND, WAITING_FOR_OPPONENT, CANCEL_MATCHMAKING, MATCHMAKING_CANCELLED, VIDEO_CALL_REQUEST, VIDEO_CALL_ACCEPTED, VIDEO_CALL_REJECTED, VIDEO_CALL_ENDED, VIDEO_OFFER, VIDEO_ANSWER, ICE_CANDIDATE } from '../types/game';
import { handleInitGame, handleSinglePlayer, handleCreateRoom, handleJoinRoom } from './game-creation';
import { handleMove } from './move-handler';
import { handleVideoCallMessage } from './video-call-handler';
import { handleEndGame, handleCancelMatchmaking, cleanupAllTimeouts } from './game-end';
import { resumeActiveGameForUser } from './game-resume';

// Constants
export const DISCONNECT_GRACE_MS = 1 * 60 * 1000; // 1 minute
export const MOVE_RATE_LIMIT_MS = 1000;
export const ROOM_CREATION_RATE_LIMIT_MS = 5000;

export const moveRateLimit = new Map<string, number>();
export const roomCreationLimit = new Map<string, number>();
export const disconnectTimeouts = new Map<string, NodeJS.Timeout>();
export let isProcessingState = false;

export function createGameState(): GameState & { videoCalls: Map<string, VideoCall> } {
    return {
        games: [],
        singlePlayerGames: [],
        pendingUser: null,
        users: [],
        rooms: new Map(),
        videoCalls: new Map()
    };
}

export function addUser(state: GameState, socket: ServerWebSocket): void {
    state.users.push(socket);
    const pendingCount = state.pendingUser ? 1 : 0;
    console.log(`==============================================[USERS] Active users: ${state.users.length}, Pending users: ${pendingCount}`);
}

export function removeUser(state: GameState, socket: ServerWebSocket): void {
    state.users = state.users.filter(user => user !== socket);
    const pendingCount = state.pendingUser ? 1 : 0;
    console.log(`==============================================[USERS] Active users: ${state.users.length}, Pending users: ${pendingCount}`);
    if (isProcessingState) {
        console.log(`==============================================[REMOVE] State is processing, retrying...`);
        setTimeout(() => removeUser(state, socket), 100);
        return;
    }
    isProcessingState = true;
    try {
        const activeGames = state.games.filter(game => 
            game.player1 === socket || game.player2 === socket
        );
        console.log(`==============================================[REMOVE] Found ${activeGames.length} active games for disconnected user`);
        for (const game of activeGames) {
            handlePlayerDisconnect(state, game, socket);
        }
        cleanupUserState(state, socket);
    } finally {
        isProcessingState = false;
    }
}

function handlePlayerDisconnect(state: GameState, game: MultiplayerGame, socket: ServerWebSocket): void {
    console.log(`==============================================[DISCONNECT] Player disconnected from game ${game.dbId}`);
    if (game.player1 === socket) game.player1 = null as any;
    if (game.player2 === socket) game.player2 = null as any;
    const opponent = game.player1 || game.player2;
    if (opponent?.readyState === 1) {
        try {
            opponent.send(JSON.stringify({ 
                type: 'opponent_disconnected',
                payload: { gracePeriodMs: DISCONNECT_GRACE_MS }
            }));
            console.log(`[DISCONNECT] Sent opponent_disconnected to remaining player`);
        } catch (error) {
            console.error('[DISCONNECT] Failed to send opponent_disconnected:', error);
        }
    }
    console.log(`[DISCONNECT] Scheduling game deletion for ${game.dbId}`);
    scheduleGameDeletion(state, game);
}

function scheduleGameDeletion(state: GameState, game: MultiplayerGame): void {
    if (disconnectTimeouts.has(game.dbId)) return;
    console.log(`[TIMER] Scheduling deletion for game ${game.dbId}`);
    const timeout = setTimeout(async () => {
        console.log(`[TIMER] Timer expired for game ${game.dbId}`);
        const currentGame = state.games.find(g => g.dbId === game.dbId);
        if (!currentGame) {
            console.log(`[TIMER] Game ${game.dbId} already deleted`);
            return;
        }
        const player1Connected = currentGame.player1?.readyState === 1;
        const player2Connected = currentGame.player2?.readyState === 1;
        console.log(`[TIMER] Player1 connected: ${player1Connected}, Player2 connected: ${player2Connected}`);
        if (player1Connected && player2Connected) {
            console.log(`[TIMER] Game ${game.dbId} has both players connected, not deleting`);
            disconnectTimeouts.delete(game.dbId);
            return;
        }
        console.log(`[TIMER] One or both players disconnected for game ${game.dbId}, proceeding with deletion`);
        await deleteGame(state, game);
    }, DISCONNECT_GRACE_MS);
    disconnectTimeouts.set(game.dbId, timeout);
}

async function deleteGame(state: GameState, game: MultiplayerGame): Promise<void> {
    console.log(`[DELETE] Starting deletion for game ${game.dbId}`);
    const connectedPlayers = [game.player1, game.player2]
        .filter(p => p?.readyState === 1);
    for (const player of connectedPlayers) {
        if (player) {
            try {
                safeSend(player, { 
                    type: 'game_ended_disconnect',
                    payload: { message: "Game ended due to opponent disconnection" }
                });
                console.log(`[DELETE] Sent game_ended_disconnect to player`);
            } catch (error) {
                console.error('Failed to send game_ended_disconnect message:', error);
            }
        }
    }
    try {
        await prisma.move.deleteMany({ where: { gameId: game.dbId } });
        await prisma.game.delete({ where: { id: game.dbId } });
        console.log(`[DELETE] Successfully deleted game ${game.dbId} from database`);
    } catch (error) {
        console.error(`[DELETE] Failed to delete game ${game.dbId}:`, error);
    }
    state.games = state.games.filter(g => g.dbId !== game.dbId);
    disconnectTimeouts.delete(game.dbId);
    console.log(`[DELETE] Completed deletion for game ${game.dbId}`);
}

export function cleanupUserState(state: GameState, socket: ServerWebSocket): void {
    state.singlePlayerGames = state.singlePlayerGames.filter(game => game.player !== socket);
    state.rooms.forEach((room, roomId) => {
        if (room.player1 === socket || room.player2 === socket) {
            const opponent = room.player1 === socket ? room.player2 : room.player1;
            if (opponent) {
                safeSend(opponent, {
                    type: 'error',
                    payload: { message: "Opponent disconnected" }
                });
            }
            state.rooms.delete(roomId);
        }
    });
    moveRateLimit.delete(socket.toString());
    roomCreationLimit.delete(socket.toString());
    if ('videoCalls' in state) {
        const stateWithVideo = state as GameState & { videoCalls: Map<string, VideoCall> };
        stateWithVideo.videoCalls.forEach((call, callId) => {
            if (call.initiator === socket || call.receiver === socket) {
                stateWithVideo.videoCalls.delete(callId);
            }
        });
    }
    if (state.pendingUser === socket) {
        state.pendingUser = null;
    }
}

export function generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function validateRoomId(roomId: string): boolean {
    return typeof roomId === 'string' && 
           roomId.length === 6 && 
           /^[A-Z0-9]+$/.test(roomId);
}

export function checkRateLimit(map: Map<string, number>, key: string, limitMs: number): boolean {
    const now = Date.now();
    const lastTime = map.get(key) || 0;
    if (now - lastTime < limitMs) return false;
    map.set(key, now);
    return true;
}

export function validateAuthentication(socket: ServerWebSocket): WebSocketWithUserId | null {
    const socketWithUserId = socket as WebSocketWithUserId;
    if (!socketWithUserId.userId) {
        safeSend(socket, {
            type: 'error',
            payload: { message: "Authentication required" }
        });
        return null;
    }
    return socketWithUserId;
}

export async function handleMessage(state: GameState & { videoCalls: Map<string, VideoCall> }, socket: ServerWebSocket, data: any): Promise<void> {
    const message = JSON.parse(data.toString());
    if ([VIDEO_CALL_REQUEST, VIDEO_CALL_ACCEPTED, VIDEO_CALL_REJECTED, VIDEO_CALL_ENDED, VIDEO_OFFER, VIDEO_ANSWER, ICE_CANDIDATE].includes(message.type)) {
        handleVideoCallMessage(state, socket, message);
        return;
    }
    switch (message.type) {
        case INIT_GAME:
            await handleInitGame(state, socket as WebSocketWithUserId);
            break;
        case SINGLE_PLAYER:
            handleSinglePlayer(state, socket);
            break;
        case CREATE_ROOM:
            handleCreateRoom(state, socket);
            break;
        case JOIN_ROOM:
            await handleJoinRoom(state, socket as WebSocketWithUserId, message.payload.roomId);
            break;
        case MOVE:
            await handleMove(state, socket, message.payload.move);
            break;
        case CANCEL_MATCHMAKING:
            handleCancelMatchmaking(state, socket);
            break;
        case 'END_GAME':
            await handleEndGame(state, socket);
            break;
    }
}

export function setupMessageHandler(state: GameState & { videoCalls: Map<string, VideoCall> }, socket: ServerWebSocket): void {
    socket.on("message", async (data) => {
        await handleMessage(state, socket, data);
    });
    socket.on('close', () => {
        removeUser(state, socket);
    });
}

export { resumeActiveGameForUser };
export { cleanupAllTimeouts }; 