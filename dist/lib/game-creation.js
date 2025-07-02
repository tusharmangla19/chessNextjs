"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleInitGame = handleInitGame;
exports.handleSinglePlayer = handleSinglePlayer;
exports.handleCreateRoom = handleCreateRoom;
exports.handleJoinRoom = handleJoinRoom;
const state_manager_1 = require("./state-manager");
const chess_js_1 = require("chess.js");
const prisma_1 = require("./prisma");
const utils_1 = require("./utils");
const game_1 = require("../types/game");
async function handleInitGame(state, socket) {
    if (!(0, state_manager_1.validateAuthentication)(socket))
        return;
    if (!state.pendingUser) {
        state.pendingUser = socket;
        (0, utils_1.safeSend)(socket, { type: game_1.WAITING_FOR_OPPONENT });
    }
    else {
        await createMultiplayerGame(state, state.pendingUser, socket);
        state.pendingUser = null;
    }
}
async function createMultiplayerGame(state, player1, player2) {
    const dbGame = await prisma_1.prisma.game.create({
        data: {
            playerWhiteId: player1.userId,
            playerBlackId: player2.userId,
            status: 'ACTIVE',
        }
    });
    const game = {
        player1,
        player2,
        board: new chess_js_1.Chess(),
        startTime: new Date(),
        moveCount: 0,
        dbId: dbGame.id
    };
    state.games.push(game);
    player1.send(JSON.stringify({ type: game_1.INIT_GAME, payload: { color: 'white' } }));
    player2.send(JSON.stringify({ type: game_1.INIT_GAME, payload: { color: 'black' } }));
}
function handleSinglePlayer(state, socket) {
    if (!(0, state_manager_1.validateAuthentication)(socket))
        return;
    const game = {
        player: socket,
        board: new chess_js_1.Chess(),
        startTime: new Date()
    };
    state.singlePlayerGames.push(game);
    socket.send(JSON.stringify({
        type: game_1.INIT_GAME,
        payload: { color: 'white' }
    }));
}
function handleCreateRoom(state, socket) {
    if (!(0, state_manager_1.validateAuthentication)(socket))
        return;
    const socketKey = socket.toString();
    if (!(0, state_manager_1.checkRateLimit)(state_manager_1.roomCreationLimit, socketKey, state_manager_1.ROOM_CREATION_RATE_LIMIT_MS)) {
        (0, utils_1.safeSend)(socket, {
            type: game_1.ERROR,
            payload: { message: "Please wait before creating another room" }
        });
        return;
    }
    const roomId = (0, state_manager_1.generateRoomId)();
    const room = {
        id: roomId,
        player1: socket
    };
    state.rooms.set(roomId, room);
    (0, utils_1.safeSend)(socket, { type: game_1.ROOM_CREATED, payload: { roomId } });
    (0, utils_1.safeSend)(socket, { type: game_1.WAITING_FOR_OPPONENT });
}
async function handleJoinRoom(state, socket, roomId) {
    if (!(0, state_manager_1.validateAuthentication)(socket))
        return;
    const room = state.rooms.get(roomId);
    if (!room) {
        socket.send(JSON.stringify({
            type: game_1.ROOM_NOT_FOUND,
            payload: { message: "Room not found" }
        }));
        return;
    }
    if (room.player2) {
        socket.send(JSON.stringify({
            type: game_1.ERROR,
            payload: { message: "Room is full" }
        }));
        return;
    }
    await createRoomGame(state, room, socket);
}
async function createRoomGame(state, room, player2) {
    room.player2 = player2;
    const player1 = room.player1;
    const dbGame = await prisma_1.prisma.game.create({
        data: {
            playerWhiteId: player1.userId,
            playerBlackId: player2.userId,
            status: 'ACTIVE',
        }
    });
    const game = {
        player1: room.player1,
        player2: room.player2,
        board: new chess_js_1.Chess(),
        startTime: new Date(),
        moveCount: 0,
        dbId: dbGame.id
    };
    room.game = game;
    state.games.push(game);
    room.player1.send(JSON.stringify({ type: game_1.ROOM_JOINED, payload: { color: 'white' } }));
    room.player2.send(JSON.stringify({ type: game_1.ROOM_JOINED, payload: { color: 'black' } }));
}
// ... move all game creation, matchmaking, and room logic here ...
// Export all these functions 
//# sourceMappingURL=game-creation.js.map