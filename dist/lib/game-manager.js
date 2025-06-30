"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGameState = createGameState;
exports.generateRoomId = generateRoomId;
exports.addUser = addUser;
exports.removeUser = removeUser;
exports.handleInitGame = handleInitGame;
exports.handleSinglePlayer = handleSinglePlayer;
exports.handleCreateRoom = handleCreateRoom;
exports.handleJoinRoom = handleJoinRoom;
exports.handleMove = handleMove;
exports.handleVideoCallMessage = handleVideoCallMessage;
exports.handleMessage = handleMessage;
exports.setupMessageHandler = setupMessageHandler;
exports.resumeActiveGameForUser = resumeActiveGameForUser;
exports.handleEndGame = handleEndGame;
exports.validateRoomId = validateRoomId;
const chess_js_1 = require("chess.js");
const game_1 = require("../types/game");
const prisma_1 = require("./prisma");
const utils_1 = require("./utils");
const END_GAME = 'END_GAME';
const moveRateLimit = new Map();
const roomCreationLimit = new Map();
const disconnectTimeouts = new Map();
const DISCONNECT_GRACE_MS = 2 * 60 * 1000; // 2 minutes
/**
 * Creates initial game state
 */
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
/**
 * Generates a random room ID
 */
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}
/**
 * Adds a new user to the game state
 */
function addUser(state, socket) {
    state.users.push(socket);
    console.log(`User connected. Total users: ${state.users.length}`);
}
/**
 * Removes a user from the game state and cleans up associated games
 */
function removeUser(state, socket) {
    state.users = state.users.filter(user => user !== socket);
    // Find all games this user is in
    const activeGames = state.games.filter(game => game.player1 === socket || game.player2 === socket);
    for (const game of activeGames) {
        // Mark this player as disconnected
        if (game.player1 === socket) {
            game.player1 = null;
        }
        if (game.player2 === socket) {
            game.player2 = null;
        }
        // If both players are disconnected, schedule deletion
        if (!game.player1 && !game.player2) {
            // Schedule DB/game cleanup after grace period
            if (!disconnectTimeouts.has(game.dbId)) {
                const timeout = setTimeout(async () => {
                    await prisma_1.prisma.move.deleteMany({ where: { gameId: game.dbId } });
                    await prisma_1.prisma.game.delete({ where: { id: game.dbId } });
                    state.games = state.games.filter(g => g.dbId !== game.dbId);
                    disconnectTimeouts.delete(game.dbId);
                }, DISCONNECT_GRACE_MS);
                disconnectTimeouts.set(game.dbId, timeout);
            }
        }
    }
    state.games = state.games.filter(game => game.player1 !== null || game.player2 !== null);
    state.singlePlayerGames = state.singlePlayerGames.filter(game => game.player !== socket);
    // Clean up rooms
    state.rooms.forEach((room, roomId) => {
        if (room.player1 === socket || room.player2 === socket) {
            const opponent = room.player1 === socket ? room.player2 : room.player1;
            if (opponent) {
                (0, utils_1.safeSend)(opponent, {
                    type: game_1.ERROR,
                    payload: { message: "Opponent disconnected" }
                });
            }
            state.rooms.delete(roomId);
        }
    });
    // Clean up rate limiting and video calls
    moveRateLimit.delete(socket.toString());
    roomCreationLimit.delete(socket.toString());
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
    console.log(`User disconnected. Total users: ${state.users.length}`);
}
/**
 * Handles the INIT_GAME message - traditional multiplayer matchmaking
 */
async function handleInitGame(state, socket) {
    console.log(`INIT_GAME request. Pending user: ${state.pendingUser ? 'exists' : 'none'}`);
    if (!state.pendingUser) {
        state.pendingUser = socket;
        console.log('Setting pending user, waiting for opponent. userId:', socket.userId);
    }
    else {
        const player1 = state.pendingUser;
        const player2 = socket;
        console.log('Pairing players:', player1.userId, player2.userId);
        state.pendingUser = null;
        // Persist game in DB
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
            dbId: dbGame.id // Store DB game ID
        };
        state.games.push(game);
        // Send game start to both players
        player1.send(JSON.stringify({
            type: game_1.INIT_GAME,
            payload: { color: 'white' }
        }));
        player2.send(JSON.stringify({
            type: game_1.INIT_GAME,
            payload: { color: 'black' }
        }));
        console.log('Multiplayer game created between two players. Sending INIT_GAME to both.');
    }
}
/**
 * Handles the SINGLE_PLAYER message - starts a single player game vs AI
 */
function handleSinglePlayer(state, socket) {
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
/**
 * Handles the CREATE_ROOM message - creates a new room for multiplayer
 */
function handleCreateRoom(state, socket) {
    const socketKey = socket.toString();
    const now = Date.now();
    const lastCreation = roomCreationLimit.get(socketKey) || 0;
    if (now - lastCreation < 5000) {
        (0, utils_1.safeSend)(socket, {
            type: game_1.ERROR,
            payload: { message: "Please wait before creating another room" }
        });
        return;
    }
    roomCreationLimit.set(socketKey, now);
    const roomId = generateRoomId();
    const room = {
        id: roomId,
        player1: socket
    };
    state.rooms.set(roomId, room);
    (0, utils_1.safeSend)(socket, {
        type: game_1.ROOM_CREATED,
        payload: { roomId }
    });
    (0, utils_1.safeSend)(socket, {
        type: game_1.WAITING_FOR_OPPONENT
    });
}
/**
 * Handles the JOIN_ROOM message - joins an existing room
 */
async function handleJoinRoom(state, socket, roomId) {
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
    room.player2 = socket;
    // Persist game in DB
    const player1 = room.player1;
    const player2 = room.player2;
    const dbGame = await prisma_1.prisma.game.create({
        data: {
            playerWhiteId: player1.userId,
            playerBlackId: player2.userId,
            status: 'ACTIVE',
        }
    });
    // Create game for the room
    const game = {
        player1: room.player1,
        player2: room.player2,
        board: new chess_js_1.Chess(),
        startTime: new Date(),
        moveCount: 0,
        dbId: dbGame.id // Store DB game ID
    };
    room.game = game;
    state.games.push(game);
    // Notify both players
    room.player1.send(JSON.stringify({
        type: game_1.ROOM_JOINED,
        payload: { color: 'white' }
    }));
    room.player2.send(JSON.stringify({
        type: game_1.ROOM_JOINED,
        payload: { color: 'black' }
    }));
}
/**
 * Handles the MOVE message - processes moves for both multiplayer and single player games
 */
async function handleMove(state, socket, move) {
    const playerId = socket.toString();
    const now = Date.now();
    const lastMove = moveRateLimit.get(playerId) || 0;
    if (now - lastMove < 1000) {
        (0, utils_1.safeSend)(socket, {
            type: game_1.ERROR,
            payload: { message: "Move too fast. Please wait a moment." }
        });
        return;
    }
    moveRateLimit.set(playerId, now);
    let multiplayerGame = state.games.find(game => game.player1 === socket || game.player2 === socket);
    if (multiplayerGame) {
        // Only allow moves if both players are present
        if (!multiplayerGame.player1 || !multiplayerGame.player2) {
            (0, utils_1.safeSend)(socket, {
                type: game_1.ERROR,
                payload: { message: "Waiting for opponent to reconnect." }
            });
            return;
        }
        try {
            // Validate turn
            const currentTurn = multiplayerGame.board.turn() === 'w' ? 'white' : 'black';
            const playerColor = multiplayerGame.player1 === socket ? 'white' : 'black';
            if (currentTurn !== playerColor) {
                (0, utils_1.safeSend)(socket, {
                    type: game_1.ERROR,
                    payload: { message: "Not your turn" }
                });
                return;
            }
            // Validate move without mutating board
            const testBoard = new chess_js_1.Chess(multiplayerGame.board.fen());
            const moveResult = testBoard.move(move);
            if (!moveResult) {
                (0, utils_1.safeSend)(socket, {
                    type: game_1.ERROR,
                    payload: { message: "Illegal move" }
                });
                return;
            }
            // Atomic DB + memory update
            await prisma_1.prisma.$transaction(async (tx) => {
                multiplayerGame.board.move(move);
                const moveNum = multiplayerGame.moveCount + 1;
                const san = moveResult.san;
                const fen = multiplayerGame.board.fen();
                await tx.move.create({
                    data: {
                        gameId: multiplayerGame.dbId,
                        moveNum,
                        from: move.from,
                        to: move.to,
                        san,
                        fen
                    }
                });
                multiplayerGame.moveCount = moveNum;
            });
            // Notify both players
            const opponent = multiplayerGame.player1 === socket ? multiplayerGame.player2 : multiplayerGame.player1;
            const moveMessage = {
                type: game_1.MOVE,
                payload: { move }
            };
            (0, utils_1.safeSend)(opponent, moveMessage);
            (0, utils_1.safeSend)(socket, moveMessage);
            // Game over check
            const gameOverResult = checkGameOver(multiplayerGame.board);
            if (gameOverResult.isOver) {
                const gameOverMessage = {
                    type: game_1.GAME_OVER,
                    payload: {
                        winner: gameOverResult.winner,
                        reason: gameOverResult.reason
                    }
                };
                (0, utils_1.safeSend)(multiplayerGame.player1, gameOverMessage);
                (0, utils_1.safeSend)(multiplayerGame.player2, gameOverMessage);
                await prisma_1.prisma.game.update({
                    where: { id: multiplayerGame.dbId },
                    data: { status: 'COMPLETED' }
                });
                state.games = state.games.filter(g => g !== multiplayerGame);
            }
        }
        catch (error) {
            console.error("Move processing error:", error);
            (0, utils_1.safeSend)(socket, {
                type: game_1.ERROR,
                payload: { message: "Move processing failed" }
            });
        }
        return;
    }
    // Single player games (apply similar validation)
    const singlePlayerGame = state.singlePlayerGames.find(game => game.player === socket);
    if (singlePlayerGame) {
        try {
            const legalMoves = singlePlayerGame.board.moves({ square: move.from, verbose: true });
            const isLegalMove = legalMoves.some((legalMove) => legalMove.from === move.from && legalMove.to === move.to);
            if (!isLegalMove) {
                (0, utils_1.safeSend)(socket, {
                    type: game_1.ERROR,
                    payload: { message: "Illegal move" }
                });
                return;
            }
            singlePlayerGame.board.move(move);
            (0, utils_1.safeSend)(socket, {
                type: game_1.MOVE,
                payload: { move }
            });
            const gameOverResult = checkGameOver(singlePlayerGame.board);
            if (gameOverResult.isOver) {
                const gameOverMessage = {
                    type: game_1.GAME_OVER,
                    payload: {
                        winner: gameOverResult.winner,
                        reason: gameOverResult.reason
                    }
                };
                (0, utils_1.safeSend)(singlePlayerGame.player, gameOverMessage);
                state.singlePlayerGames = state.singlePlayerGames.filter(g => g !== singlePlayerGame);
            }
        }
        catch (error) {
            console.error("Single player move validation error:", error);
            (0, utils_1.safeSend)(socket, {
                type: game_1.ERROR,
                payload: { message: "Invalid move" }
            });
        }
        return;
    }
    (0, utils_1.safeSend)(socket, {
        type: game_1.ERROR,
        payload: { message: "No active game found" }
    });
}
/**
 * Comprehensive game over detection
 */
function checkGameOver(board) {
    if (board.isCheckmate()) {
        const winner = board.turn() === 'w' ? 'black' : 'white';
        return { isOver: true, winner, reason: 'checkmate' };
    }
    if (board.isDraw()) {
        // Determine the specific draw reason
        if (board.isStalemate()) {
            return { isOver: true, winner: null, reason: 'stalemate' };
        }
        if (board.isThreefoldRepetition()) {
            return { isOver: true, winner: null, reason: 'threefold_repetition' };
        }
        if (board.isInsufficientMaterial()) {
            return { isOver: true, winner: null, reason: 'insufficient_material' };
        }
        if (board.isDraw()) {
            return { isOver: true, winner: null, reason: 'fifty_move_rule' };
        }
        return { isOver: true, winner: null, reason: 'draw' };
    }
    return { isOver: false, winner: null, reason: '' };
}
/**
 * Handles video call messages
 */
function handleVideoCallMessage(state, socket, message) {
    switch (message.type) {
        case game_1.VIDEO_CALL_REQUEST:
            handleVideoCallRequest(state, socket, message);
            break;
        case game_1.VIDEO_CALL_ACCEPTED:
            handleVideoCallAccepted(state, socket, message);
            break;
        case game_1.VIDEO_CALL_REJECTED:
            handleVideoCallRejected(state, socket, message);
            break;
        case game_1.VIDEO_CALL_ENDED:
            handleVideoCallEnded(state, socket, message);
            break;
        case game_1.VIDEO_OFFER:
        case game_1.VIDEO_ANSWER:
        case game_1.ICE_CANDIDATE:
            handleVideoSignaling(state, socket, message);
            break;
    }
}
/**
 * Handles video call request
 */
function handleVideoCallRequest(state, socket, message) {
    const { payload } = message;
    const callId = payload?.callId;
    if (!callId)
        return;
    let targetUser = null;
    // Check multiplayer games first
    const game = state.games.find(game => game.player1 === socket || game.player2 === socket);
    if (game) {
        targetUser = game.player1 === socket ? game.player2 : game.player1;
    }
    // If no game found, check rooms
    if (!targetUser) {
        state.rooms.forEach((room) => {
            if (room.player1 === socket && room.player2) {
                targetUser = room.player2;
            }
            else if (room.player2 === socket && room.player1) {
                targetUser = room.player1;
            }
        });
    }
    if (targetUser) {
        const videoCall = {
            id: callId,
            initiator: socket,
            status: 'pending',
            startTime: new Date()
        };
        state.videoCalls.set(callId, videoCall);
        const forwardMessage = {
            type: game_1.VIDEO_CALL_REQUEST,
            payload: { callId },
            from: 'opponent',
            to: 'you'
        };
        targetUser.send(JSON.stringify(forwardMessage));
    }
    else {
        const errorMessage = {
            type: game_1.ERROR,
            payload: { message: "No opponent available for video call" }
        };
        socket.send(JSON.stringify(errorMessage));
    }
}
/**
 * Handles video call accepted
 */
function handleVideoCallAccepted(state, socket, message) {
    const { payload } = message;
    const callId = payload?.callId;
    if (!callId)
        return;
    const videoCall = state.videoCalls.get(callId);
    if (videoCall && videoCall.initiator !== socket) {
        videoCall.receiver = socket;
        videoCall.status = 'active';
        videoCall.initiator.send(JSON.stringify({
            type: game_1.VIDEO_CALL_ACCEPTED,
            payload: { callId },
            from: 'opponent',
            to: 'you'
        }));
    }
}
/**
 * Handles video call rejected
 */
function handleVideoCallRejected(state, socket, message) {
    const { payload } = message;
    const callId = payload?.callId;
    if (!callId)
        return;
    const videoCall = state.videoCalls.get(callId);
    if (videoCall) {
        videoCall.initiator.send(JSON.stringify({
            type: game_1.VIDEO_CALL_REJECTED,
            payload: { callId },
            from: 'opponent',
            to: 'you'
        }));
        state.videoCalls.delete(callId);
    }
}
/**
 * Handles video call ended
 */
function handleVideoCallEnded(state, socket, message) {
    const { payload } = message;
    const callId = payload?.callId;
    if (!callId)
        return;
    const videoCall = state.videoCalls.get(callId);
    if (videoCall) {
        const otherParticipant = videoCall.initiator === socket ? videoCall.receiver : videoCall.initiator;
        if (otherParticipant) {
            otherParticipant.send(JSON.stringify({
                type: game_1.VIDEO_CALL_ENDED,
                payload: { callId },
                from: 'opponent',
                to: 'you'
            }));
        }
        state.videoCalls.delete(callId);
    }
}
/**
 * Handles video signaling (offer, answer, ICE candidates)
 */
function handleVideoSignaling(state, socket, message) {
    const { payload, callId } = message;
    if (!callId)
        return;
    const videoCall = state.videoCalls.get(callId);
    if (videoCall && videoCall.status === 'active') {
        const otherParticipant = videoCall.initiator === socket ? videoCall.receiver : videoCall.initiator;
        if (otherParticipant) {
            otherParticipant.send(JSON.stringify({
                type: message.type,
                payload: message.payload,
                from: 'opponent',
                to: 'you',
                callId
            }));
        }
    }
}
/**
 * Handles incoming messages from a WebSocket
 */
async function handleMessage(state, socket, data) {
    const message = JSON.parse(data.toString());
    if ([game_1.VIDEO_CALL_REQUEST, game_1.VIDEO_CALL_ACCEPTED, game_1.VIDEO_CALL_REJECTED, game_1.VIDEO_CALL_ENDED, game_1.VIDEO_OFFER, game_1.VIDEO_ANSWER, game_1.ICE_CANDIDATE].includes(message.type)) {
        handleVideoCallMessage(state, socket, message);
        return;
    }
    switch (message.type) {
        case game_1.INIT_GAME:
            await handleInitGame(state, socket);
            break;
        case game_1.SINGLE_PLAYER:
            handleSinglePlayer(state, socket);
            break;
        case game_1.CREATE_ROOM:
            handleCreateRoom(state, socket);
            break;
        case game_1.JOIN_ROOM:
            await handleJoinRoom(state, socket, message.payload.roomId);
            break;
        case game_1.MOVE:
            await handleMove(state, socket, message.payload.move);
            break;
        case END_GAME:
            await handleEndGame(state, socket);
            break;
    }
}
/**
 * Sets up message handler for a WebSocket
 */
function setupMessageHandler(state, socket) {
    socket.on("message", async (data) => {
        await handleMessage(state, socket, data);
    });
    socket.on('close', async () => {
        await handleEndGame(state, socket);
        removeUser(state, socket);
    });
}
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
        if (!dbGame)
            return;
        const dbMoves = await prisma_1.prisma.move.findMany({
            where: { gameId: dbGame.id },
            orderBy: { moveNum: 'asc' }
        });
        const chess = new chess_js_1.Chess();
        const moveHistory = [];
        for (const m of dbMoves) {
            chess.move({ from: m.from, to: m.to });
            moveHistory.push({ from: m.from, to: m.to, san: m.san, fen: m.fen });
        }
        let inMemoryGame = state.games.find(g => g.dbId === dbGame.id);
        const isWhite = dbGame.playerWhiteId === ws.userId;
        const isBlack = dbGame.playerBlackId === ws.userId;
        const otherUserId = isWhite ? dbGame.playerBlackId : dbGame.playerWhiteId;
        const otherSocket = state.users.find(u => u.userId === otherUserId);
        if (!inMemoryGame) {
            inMemoryGame = {
                player1: isWhite ? ws : (otherSocket ?? null),
                player2: isBlack ? ws : (otherSocket ?? null),
                board: chess,
                startTime: dbGame.createdAt,
                moveCount: dbMoves.length,
                dbId: dbGame.id,
                waitingForOpponent: !otherSocket
            };
            state.games.push(inMemoryGame);
        }
        else {
            if (isWhite)
                inMemoryGame.player1 = ws;
            if (isBlack)
                inMemoryGame.player2 = ws;
            inMemoryGame.waitingForOpponent = !otherSocket;
        }
        // Cancel disconnect timeout if present
        if (disconnectTimeouts.has(dbGame.id)) {
            clearTimeout(disconnectTimeouts.get(dbGame.id));
            disconnectTimeouts.delete(dbGame.id);
        }
        const color = isWhite ? 'white' : 'black';
        (0, utils_1.safeSend)(ws, {
            type: 'resume_game',
            payload: {
                color,
                fen: chess.fen(),
                moveHistory,
                opponentConnected: !!otherSocket,
                waitingForOpponent: !otherSocket
            }
        });
    }
    catch (error) {
        console.error('Resume game error:', error);
    }
}
async function handleEndGame(state, socket) {
    // Find the active game for this socket
    const gameIdx = state.games.findIndex(g => g.player1 === socket || g.player2 === socket);
    if (gameIdx === -1)
        return;
    const game = state.games[gameIdx];
    // Delete moves and game from DB
    if (game.dbId) {
        await prisma_1.prisma.move.deleteMany({ where: { gameId: game.dbId } });
        await prisma_1.prisma.game.delete({ where: { id: game.dbId } });
    }
    // Remove from in-memory state
    state.games.splice(gameIdx, 1);
    // Notify opponent
    const opponent = game.player1 === socket ? game.player2 : game.player1;
    if (opponent && opponent.readyState === 1) {
        opponent.send(JSON.stringify({ type: 'opponent_left' }));
    }
}
// --- Input validation for room IDs ---
function validateRoomId(roomId) {
    return typeof roomId === 'string' &&
        roomId.length === 6 &&
        /^[A-Z0-9]+$/.test(roomId);
}
//# sourceMappingURL=game-manager.js.map