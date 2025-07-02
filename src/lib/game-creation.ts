import type { GameState, WebSocketWithUserId, ServerWebSocket, GameRoom, MultiplayerGame, SinglePlayerGame } from '../types/game';
import { generateRoomId, checkRateLimit, validateAuthentication, ROOM_CREATION_RATE_LIMIT_MS, moveRateLimit, roomCreationLimit } from './state-manager';
import { Chess } from 'chess.js';
import { prisma } from './prisma';
import { safeSend } from './utils';
import { INIT_GAME, WAITING_FOR_OPPONENT, ROOM_CREATED, ROOM_JOINED, ROOM_NOT_FOUND, ERROR } from '../types/game';

export async function handleInitGame(state: GameState, socket: WebSocketWithUserId): Promise<void> {
    if (!validateAuthentication(socket)) return;
    if (!state.pendingUser) {
        state.pendingUser = socket;
        safeSend(socket, { type: WAITING_FOR_OPPONENT });
    } else {
        await createMultiplayerGame(state, state.pendingUser as WebSocketWithUserId, socket);
        state.pendingUser = null;
    }
}

async function createMultiplayerGame(state: GameState, player1: WebSocketWithUserId, player2: WebSocketWithUserId): Promise<void> {
    const dbGame = await prisma.game.create({
        data: {
            playerWhiteId: player1.userId,
            playerBlackId: player2.userId,
            status: 'ACTIVE',
        }
    });
    const game: MultiplayerGame = {
        player1,
        player2,
        board: new Chess(),
        startTime: new Date(),
        moveCount: 0,
        dbId: dbGame.id
    };
    state.games.push(game);
    (player1 as any).send(JSON.stringify({ type: INIT_GAME, payload: { color: 'white' } }));
    (player2 as any).send(JSON.stringify({ type: INIT_GAME, payload: { color: 'black' } }));
}

export function handleSinglePlayer(state: GameState, socket: ServerWebSocket): void {
    if (!validateAuthentication(socket)) return;
    const game: SinglePlayerGame = {
        player: socket,
        board: new Chess(),
        startTime: new Date()
    };
    state.singlePlayerGames.push(game);
    socket.send(JSON.stringify({
        type: INIT_GAME,
        payload: { color: 'white' }
    }));
}

export function handleCreateRoom(state: GameState, socket: ServerWebSocket): void {
    if (!validateAuthentication(socket)) return;
    const socketKey = socket.toString();
    if (!checkRateLimit(roomCreationLimit, socketKey, ROOM_CREATION_RATE_LIMIT_MS)) {
        safeSend(socket, {
            type: ERROR,
            payload: { message: "Please wait before creating another room" }
        });
        return;
    }
    const roomId = generateRoomId();
    const room: GameRoom = {
        id: roomId,
        player1: socket
    };
    state.rooms.set(roomId, room);
    safeSend(socket, { type: ROOM_CREATED, payload: { roomId } });
    safeSend(socket, { type: WAITING_FOR_OPPONENT });
}

export async function handleJoinRoom(state: GameState, socket: WebSocketWithUserId, roomId: string): Promise<void> {
    if (!validateAuthentication(socket)) return;
    const room = state.rooms.get(roomId);
    if (!room) {
        (socket as any).send(JSON.stringify({
            type: ROOM_NOT_FOUND,
            payload: { message: "Room not found" }
        }));
        return;
    }
    if (room.player2) {
        (socket as any).send(JSON.stringify({
            type: ERROR,
            payload: { message: "Room is full" }
        }));
        return;
    }
    await createRoomGame(state, room, socket);
}

async function createRoomGame(state: GameState, room: GameRoom, player2: WebSocketWithUserId): Promise<void> {
    room.player2 = player2;
    const player1 = room.player1 as WebSocketWithUserId;
    const dbGame = await prisma.game.create({
        data: {
            playerWhiteId: player1.userId,
            playerBlackId: player2.userId,
            status: 'ACTIVE',
        }
    });
    const game: MultiplayerGame = {
        player1: room.player1,
        player2: room.player2,
        board: new Chess(),
        startTime: new Date(),
        moveCount: 0,
        dbId: dbGame.id
    };
    room.game = game;
    state.games.push(game);
    room.player1.send(JSON.stringify({ type: ROOM_JOINED, payload: { color: 'white' } }));
    room.player2.send(JSON.stringify({ type: ROOM_JOINED, payload: { color: 'black' } }));
}

// ... move all game creation, matchmaking, and room logic here ...
// Export all these functions 