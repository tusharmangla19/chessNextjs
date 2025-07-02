"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupAllTimeouts = exports.resumeActiveGameForUser = exports.isProcessingState = exports.disconnectTimeouts = exports.roomCreationLimit = exports.moveRateLimit = exports.ROOM_CREATION_RATE_LIMIT_MS = exports.MOVE_RATE_LIMIT_MS = exports.DISCONNECT_GRACE_MS = void 0;
exports.createGameState = createGameState;
exports.addUser = addUser;
exports.removeUser = removeUser;
exports.cleanupUserState = cleanupUserState;
exports.generateRoomId = generateRoomId;
exports.validateRoomId = validateRoomId;
exports.checkRateLimit = checkRateLimit;
exports.validateAuthentication = validateAuthentication;
exports.handleMessage = handleMessage;
exports.setupMessageHandler = setupMessageHandler;
const prisma_1 = require("./prisma");
const utils_1 = require("./utils");
const game_1 = require("../types/game");
const game_creation_1 = require("./game-creation");
const move_handler_1 = require("./move-handler");
const video_call_handler_1 = require("./video-call-handler");
const game_end_1 = require("./game-end");
Object.defineProperty(exports, "cleanupAllTimeouts", { enumerable: true, get: function () { return game_end_1.cleanupAllTimeouts; } });
const game_resume_1 = require("./game-resume");
Object.defineProperty(exports, "resumeActiveGameForUser", { enumerable: true, get: function () { return game_resume_1.resumeActiveGameForUser; } });
// Constants
exports.DISCONNECT_GRACE_MS = 1 * 60 * 1000; // 1 minute
exports.MOVE_RATE_LIMIT_MS = 1000;
exports.ROOM_CREATION_RATE_LIMIT_MS = 5000;
exports.moveRateLimit = new Map();
exports.roomCreationLimit = new Map();
exports.disconnectTimeouts = new Map();
exports.isProcessingState = false;
function createGameState() {
    return {
        games: [],
        singlePlayerGames: [],
        pendingUser: null,
        users: [],
        rooms: new Map(),
        videoCalls: new Map()
    };
}
function addUser(state, socket) {
    state.users.push(socket);
    const pendingCount = state.pendingUser ? 1 : 0;
    console.log(`==============================================[USERS] Active users: ${state.users.length}, Pending users: ${pendingCount}`);
}
function removeUser(state, socket) {
    state.users = state.users.filter(user => user !== socket);
    const pendingCount = state.pendingUser ? 1 : 0;
    console.log(`==============================================[USERS] Active users: ${state.users.length}, Pending users: ${pendingCount}`);
    if (exports.isProcessingState) {
        console.log(`==============================================[REMOVE] State is processing, retrying...`);
        setTimeout(() => removeUser(state, socket), 100);
        return;
    }
    exports.isProcessingState = true;
    try {
        const activeGames = state.games.filter(game => game.player1 === socket || game.player2 === socket);
        console.log(`==============================================[REMOVE] Found ${activeGames.length} active games for disconnected user`);
        for (const game of activeGames) {
            handlePlayerDisconnect(state, game, socket);
        }
        cleanupUserState(state, socket);
    }
    finally {
        exports.isProcessingState = false;
    }
}
function handlePlayerDisconnect(state, game, socket) {
    console.log(`==============================================[DISCONNECT] Player disconnected from game ${game.dbId}`);
    if (game.player1 === socket)
        game.player1 = null;
    if (game.player2 === socket)
        game.player2 = null;
    const opponent = game.player1 || game.player2;
    if (opponent?.readyState === 1) {
        try {
            opponent.send(JSON.stringify({
                type: 'opponent_disconnected',
                payload: { gracePeriodMs: exports.DISCONNECT_GRACE_MS }
            }));
            console.log(`[DISCONNECT] Sent opponent_disconnected to remaining player`);
        }
        catch (error) {
            console.error('[DISCONNECT] Failed to send opponent_disconnected:', error);
        }
    }
    console.log(`[DISCONNECT] Scheduling game deletion for ${game.dbId}`);
    scheduleGameDeletion(state, game);
}
function scheduleGameDeletion(state, game) {
    if (exports.disconnectTimeouts.has(game.dbId))
        return;
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
            exports.disconnectTimeouts.delete(game.dbId);
            return;
        }
        console.log(`[TIMER] One or both players disconnected for game ${game.dbId}, proceeding with deletion`);
        await deleteGame(state, game);
    }, exports.DISCONNECT_GRACE_MS);
    exports.disconnectTimeouts.set(game.dbId, timeout);
}
async function deleteGame(state, game) {
    console.log(`[DELETE] Starting deletion for game ${game.dbId}`);
    const connectedPlayers = [game.player1, game.player2]
        .filter(p => p?.readyState === 1);
    for (const player of connectedPlayers) {
        if (player) {
            try {
                (0, utils_1.safeSend)(player, {
                    type: 'game_ended_disconnect',
                    payload: { message: "Game ended due to opponent disconnection" }
                });
                console.log(`[DELETE] Sent game_ended_disconnect to player`);
            }
            catch (error) {
                console.error('Failed to send game_ended_disconnect message:', error);
            }
        }
    }
    try {
        await prisma_1.prisma.move.deleteMany({ where: { gameId: game.dbId } });
        await prisma_1.prisma.game.delete({ where: { id: game.dbId } });
        console.log(`[DELETE] Successfully deleted game ${game.dbId} from database`);
    }
    catch (error) {
        console.error(`[DELETE] Failed to delete game ${game.dbId}:`, error);
    }
    state.games = state.games.filter(g => g.dbId !== game.dbId);
    exports.disconnectTimeouts.delete(game.dbId);
    console.log(`[DELETE] Completed deletion for game ${game.dbId}`);
}
function cleanupUserState(state, socket) {
    state.singlePlayerGames = state.singlePlayerGames.filter(game => game.player !== socket);
    state.rooms.forEach((room, roomId) => {
        if (room.player1 === socket || room.player2 === socket) {
            const opponent = room.player1 === socket ? room.player2 : room.player1;
            if (opponent) {
                (0, utils_1.safeSend)(opponent, {
                    type: 'error',
                    payload: { message: "Opponent disconnected" }
                });
            }
            state.rooms.delete(roomId);
        }
    });
    exports.moveRateLimit.delete(socket.toString());
    exports.roomCreationLimit.delete(socket.toString());
    if ('videoCalls' in state) {
        const stateWithVideo = state;
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
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}
function validateRoomId(roomId) {
    return typeof roomId === 'string' &&
        roomId.length === 6 &&
        /^[A-Z0-9]+$/.test(roomId);
}
function checkRateLimit(map, key, limitMs) {
    const now = Date.now();
    const lastTime = map.get(key) || 0;
    if (now - lastTime < limitMs)
        return false;
    map.set(key, now);
    return true;
}
function validateAuthentication(socket) {
    const socketWithUserId = socket;
    if (!socketWithUserId.userId) {
        (0, utils_1.safeSend)(socket, {
            type: 'error',
            payload: { message: "Authentication required" }
        });
        return null;
    }
    return socketWithUserId;
}
async function handleMessage(state, socket, data) {
    const message = JSON.parse(data.toString());
    if ([game_1.VIDEO_CALL_REQUEST, game_1.VIDEO_CALL_ACCEPTED, game_1.VIDEO_CALL_REJECTED, game_1.VIDEO_CALL_ENDED, game_1.VIDEO_OFFER, game_1.VIDEO_ANSWER, game_1.ICE_CANDIDATE].includes(message.type)) {
        (0, video_call_handler_1.handleVideoCallMessage)(state, socket, message);
        return;
    }
    switch (message.type) {
        case game_1.INIT_GAME:
            await (0, game_creation_1.handleInitGame)(state, socket);
            break;
        case game_1.SINGLE_PLAYER:
            (0, game_creation_1.handleSinglePlayer)(state, socket);
            break;
        case game_1.CREATE_ROOM:
            (0, game_creation_1.handleCreateRoom)(state, socket);
            break;
        case game_1.JOIN_ROOM:
            await (0, game_creation_1.handleJoinRoom)(state, socket, message.payload.roomId);
            break;
        case game_1.MOVE:
            await (0, move_handler_1.handleMove)(state, socket, message.payload.move);
            break;
        case game_1.CANCEL_MATCHMAKING:
            (0, game_end_1.handleCancelMatchmaking)(state, socket);
            break;
        case 'END_GAME':
            await (0, game_end_1.handleEndGame)(state, socket);
            break;
    }
}
function setupMessageHandler(state, socket) {
    socket.on("message", async (data) => {
        await handleMessage(state, socket, data);
    });
    socket.on('close', () => {
        removeUser(state, socket);
    });
}
//# sourceMappingURL=state-manager.js.map