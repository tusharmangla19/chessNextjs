"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGameState = createGameState;
exports.addUser = addUser;
exports.removeUser = removeUser;
exports.generateRoomId = generateRoomId;
exports.validateRoomId = validateRoomId;
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
exports.cleanupAllTimeouts = cleanupAllTimeouts;
const chess_js_1 = require("chess.js");
const game_1 = require("../types/game");
const prisma_1 = require("./prisma");
const utils_1 = require("./utils");
// Constants
const DISCONNECT_GRACE_MS = 1 * 60 * 1000; // 1 minute
const MOVE_RATE_LIMIT_MS = 1000;
const ROOM_CREATION_RATE_LIMIT_MS = 5000;
// State management
const moveRateLimit = new Map();
const roomCreationLimit = new Map();
const disconnectTimeouts = new Map();
let isProcessingState = false;
// ============================================================================
// CORE STATE MANAGEMENT
// ============================================================================
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
}
function removeUser(state, socket) {
    if (isProcessingState) {
        setTimeout(() => removeUser(state, socket), 100);
        return;
    }
    isProcessingState = true;
    try {
        state.users = state.users.filter(user => user !== socket);
        const activeGames = state.games.filter(game => game.player1 === socket || game.player2 === socket);
        for (const game of activeGames) {
            handlePlayerDisconnect(state, game, socket);
        }
        cleanupUserState(state, socket);
    }
    finally {
        isProcessingState = false;
    }
}
function handlePlayerDisconnect(state, game, socket) {
    if (game.player1 === socket)
        game.player1 = null;
    if (game.player2 === socket)
        game.player2 = null;
    const opponent = game.player1 || game.player2;
    if (opponent?.readyState === 1) {
        try {
            opponent.send(JSON.stringify({
                type: 'opponent_disconnected',
                payload: { gracePeriodMs: DISCONNECT_GRACE_MS }
            }));
        }
        catch (error) {
            // Handle error silently
        }
    }
    scheduleGameDeletion(state, game);
}
function scheduleGameDeletion(state, game) {
    if (disconnectTimeouts.has(game.dbId))
        return;
    // Add a small delay to give players a chance to reconnect quickly
    const timeout = setTimeout(async () => {
        // Double-check that the game still exists and no players have reconnected
        const currentGame = state.games.find(g => g.dbId === game.dbId);
        if (!currentGame)
            return; // Game was already deleted
        // Check if both players are still disconnected
        if (currentGame.player1?.readyState === 1 || currentGame.player2?.readyState === 1) {
            // At least one player is connected, don't delete
            disconnectTimeouts.delete(game.dbId);
            return;
        }
        await deleteGame(state, game);
    }, DISCONNECT_GRACE_MS);
    disconnectTimeouts.set(game.dbId, timeout);
}
async function deleteGame(state, game) {
    const connectedPlayers = [game.player1, game.player2]
        .filter(p => p?.readyState === 1);
    //readyState 1 means open
    for (const player of connectedPlayers) {
        try {
            player?.send(JSON.stringify({
                type: 'game_ended_disconnect',
                payload: { message: "Game ended due to opponent disconnection" }
            }));
        }
        catch (error) {
            // Handle error silently
        }
    }
    try {
        await prisma_1.prisma.move.deleteMany({ where: { gameId: game.dbId } });
        await prisma_1.prisma.game.delete({ where: { id: game.dbId } });
    }
    catch (error) {
        // Handle error silently
    }
    state.games = state.games.filter(g => g.dbId !== game.dbId);
    disconnectTimeouts.delete(game.dbId);
}
function cleanupUserState(state, socket) {
    state.singlePlayerGames = state.singlePlayerGames.filter(game => game.player !== socket);
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
}
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
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
            type: game_1.ERROR,
            payload: { message: "Authentication required" }
        });
        return null;
    }
    return socketWithUserId;
}
function checkGameOver(board) {
    if (board.isCheckmate()) {
        const winner = board.turn() === 'w' ? 'black' : 'white';
        return { isOver: true, winner, reason: 'checkmate' };
    }
    if (board.isDraw()) {
        if (board.isStalemate())
            return { isOver: true, winner: null, reason: 'stalemate' };
        if (board.isThreefoldRepetition())
            return { isOver: true, winner: null, reason: 'threefold_repetition' };
        if (board.isInsufficientMaterial())
            return { isOver: true, winner: null, reason: 'insufficient_material' };
        return { isOver: true, winner: null, reason: 'fifty_move_rule' };
    }
    return { isOver: false, winner: null, reason: '' };
}
// ============================================================================
// GAME CREATION HANDLERS
// ============================================================================
async function handleInitGame(state, socket) {
    if (!validateAuthentication(socket))
        return;
    if (!state.pendingUser) {
        state.pendingUser = socket;
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
    if (!validateAuthentication(socket))
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
    if (!validateAuthentication(socket))
        return;
    const socketKey = socket.toString();
    if (!checkRateLimit(roomCreationLimit, socketKey, ROOM_CREATION_RATE_LIMIT_MS)) {
        (0, utils_1.safeSend)(socket, {
            type: game_1.ERROR,
            payload: { message: "Please wait before creating another room" }
        });
        return;
    }
    const roomId = generateRoomId();
    const room = {
        id: roomId,
        player1: socket
    };
    state.rooms.set(roomId, room);
    (0, utils_1.safeSend)(socket, { type: game_1.ROOM_CREATED, payload: { roomId } });
    (0, utils_1.safeSend)(socket, { type: game_1.WAITING_FOR_OPPONENT });
}
async function handleJoinRoom(state, socket, roomId) {
    if (!validateAuthentication(socket))
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
// ============================================================================
// MOVE HANDLING
// ============================================================================
async function handleMove(state, socket, move) {
    if (!validateAuthentication(socket))
        return;
    const playerId = socket.toString();
    if (!checkRateLimit(moveRateLimit, playerId, MOVE_RATE_LIMIT_MS)) {
        (0, utils_1.safeSend)(socket, {
            type: game_1.ERROR,
            payload: { message: "Move too fast. Please wait a moment." }
        });
        return;
    }
    const multiplayerGame = state.games.find(game => game.player1 === socket || game.player2 === socket);
    if (multiplayerGame) {
        await handleMultiplayerMove(state, multiplayerGame, socket, move);
        return;
    }
    const singlePlayerGame = state.singlePlayerGames.find(game => game.player === socket);
    if (singlePlayerGame) {
        handleSinglePlayerMove(singlePlayerGame, socket, move);
        return;
    }
    (0, utils_1.safeSend)(socket, {
        type: game_1.ERROR,
        payload: { message: "No active game found" }
    });
}
async function handleMultiplayerMove(state, game, socket, move) {
    const isPlayer1 = game.player1 === socket;
    const isPlayer2 = game.player2 === socket;
    if (!isPlayer1 && !isPlayer2) {
        (0, utils_1.safeSend)(socket, { type: game_1.ERROR, payload: { message: "You are not a player in this game" } });
        return;
    }
    if (!game.player1 || !game.player2) {
        (0, utils_1.safeSend)(socket, { type: game_1.ERROR, payload: { message: "Waiting for opponent to reconnect." } });
        return;
    }
    try {
        const currentTurn = game.board.turn() === 'w' ? 'white' : 'black';
        const playerColor = isPlayer1 ? 'white' : 'black';
        if (currentTurn !== playerColor) {
            (0, utils_1.safeSend)(socket, { type: game_1.ERROR, payload: { message: "Not your turn" } });
            return;
        }
        if (!validatePawnPromotion(game.board, move)) {
            (0, utils_1.safeSend)(socket, {
                type: game_1.ERROR,
                payload: { message: "Pawn promotion required! Please select Queen, Rook, Bishop, or Knight." }
            });
            return;
        }
        const testBoard = new chess_js_1.Chess(game.board.fen());
        const moveResult = testBoard.move(move);
        if (!moveResult) {
            (0, utils_1.safeSend)(socket, { type: game_1.ERROR, payload: { message: "Illegal move" } });
            return;
        }
        await executeMove(game, move, moveResult);
        const opponent = isPlayer1 ? game.player2 : game.player1;
        const moveMessage = { type: game_1.MOVE, payload: { move } };
        (0, utils_1.safeSend)(opponent, moveMessage);
        (0, utils_1.safeSend)(socket, moveMessage);
        await checkAndHandleGameOver(state, game);
    }
    catch (error) {
        console.error('Move processing error:', error);
        // Provide more specific error messages based on the error type
        let errorMessage = "Invalid move";
        if (error instanceof Error) {
            if (error.message.includes('Invalid move')) {
                errorMessage = "That move is not allowed in chess";
            }
            else if (error.message.includes('promotion')) {
                errorMessage = "Please select a piece for pawn promotion (Queen, Rook, Bishop, or Knight)";
            }
            else if (error.message.includes('turn')) {
                errorMessage = "It's not your turn to move";
            }
            else if (error.message.includes('check')) {
                errorMessage = "You must move to get out of check";
            }
            else if (error.message.includes('database') || error.message.includes('transaction')) {
                errorMessage = "Game state error. Please try again.";
            }
        }
        (0, utils_1.safeSend)(socket, { type: game_1.ERROR, payload: { message: errorMessage } });
    }
}
function validatePawnPromotion(board, move) {
    const piece = board.get(move.from);
    const isPawn = piece?.type === 'p';
    const isLastRank = (piece?.color === 'w' && move.to[1] === '8') ||
        (piece?.color === 'b' && move.to[1] === '1');
    if (isPawn && isLastRank) {
        return move.promotion ? ['q', 'r', 'b', 'n'].includes(move.promotion) : false;
    }
    return true;
}
async function executeMove(game, move, moveResult) {
    await prisma_1.prisma.$transaction(async (tx) => {
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
async function checkAndHandleGameOver(state, game) {
    const gameOverResult = checkGameOver(game.board);
    if (!gameOverResult.isOver)
        return;
    const gameOverMessage = {
        type: game_1.GAME_OVER,
        payload: {
            winner: gameOverResult.winner,
            reason: gameOverResult.reason
        }
    };
    if (game.player1)
        (0, utils_1.safeSend)(game.player1, gameOverMessage);
    if (game.player2)
        (0, utils_1.safeSend)(game.player2, gameOverMessage);
    await prisma_1.prisma.game.update({
        where: { id: game.dbId },
        data: { status: 'COMPLETED' }
    });
    state.games = state.games.filter(g => g !== game);
}
function handleSinglePlayerMove(game, socket, move) {
    try {
        const piece = game.board.get(move.from);
        const isPawn = piece?.type === 'p';
        const isLastRank = (piece?.color === 'w' && move.to[1] === '8') ||
            (piece?.color === 'b' && move.to[1] === '1');
        if (isPawn && isLastRank) {
            if (!move.promotion || !['q', 'r', 'b', 'n'].includes(move.promotion)) {
                (0, utils_1.safeSend)(socket, {
                    type: game_1.ERROR,
                    payload: { message: "Pawn promotion required! Please select Queen, Rook, Bishop, or Knight." }
                });
                return;
            }
        }
        const legalMoves = game.board.moves({ square: move.from, verbose: true });
        const isLegalMove = legalMoves.some((legalMove) => legalMove.from === move.from && legalMove.to === move.to &&
            (!isPawn || !isLastRank || legalMove.promotion === move.promotion));
        if (!isLegalMove) {
            (0, utils_1.safeSend)(socket, { type: game_1.ERROR, payload: { message: "Illegal move" } });
            return;
        }
        game.board.move(move);
        (0, utils_1.safeSend)(socket, { type: game_1.MOVE, payload: { move } });
        const gameOverResult = checkGameOver(game.board);
        if (gameOverResult.isOver) {
            const gameOverMessage = {
                type: game_1.GAME_OVER,
                payload: {
                    winner: gameOverResult.winner,
                    reason: gameOverResult.reason
                }
            };
            (0, utils_1.safeSend)(game.player, gameOverMessage);
            // Remove game from single player games
            // Note: This should be handled by the calling function with proper state access
        }
    }
    catch (error) {
        console.error('Single player move error:', error);
        // Provide more specific error messages based on the error type
        let errorMessage = "Invalid move";
        if (error instanceof Error) {
            if (error.message.includes('Invalid move')) {
                errorMessage = "That move is not allowed in chess";
            }
            else if (error.message.includes('promotion')) {
                errorMessage = "Please select a piece for pawn promotion (Queen, Rook, Bishop, or Knight)";
            }
            else if (error.message.includes('turn')) {
                errorMessage = "It's not your turn to move";
            }
            else if (error.message.includes('check')) {
                errorMessage = "You must move to get out of check";
            }
        }
        (0, utils_1.safeSend)(socket, { type: game_1.ERROR, payload: { message: errorMessage } });
    }
}
// ============================================================================
// VIDEO CALL HANDLING
// ============================================================================
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
function handleVideoCallRequest(state, socket, message) {
    const { payload } = message;
    const callId = payload?.callId;
    if (!callId)
        return;
    const targetUser = findOpponent(state, socket);
    if (!targetUser) {
        socket.send(JSON.stringify({
            type: game_1.ERROR,
            payload: { message: "No opponent available for video call" }
        }));
        return;
    }
    const videoCall = {
        id: callId,
        initiator: socket,
        status: 'pending',
        startTime: new Date()
    };
    state.videoCalls.set(callId, videoCall);
    targetUser.send(JSON.stringify({
        type: game_1.VIDEO_CALL_REQUEST,
        payload: { callId },
        from: 'opponent',
        to: 'you'
    }));
}
function findOpponent(state, socket) {
    const game = state.games.find(game => game.player1 === socket || game.player2 === socket);
    if (game) {
        return game.player1 === socket ? game.player2 : game.player1;
    }
    for (const room of Array.from(state.rooms.values())) {
        if (room.player1 === socket && room.player2)
            return room.player2;
        if (room.player2 === socket && room.player1)
            return room.player1;
    }
    return null;
}
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
function handleVideoSignaling(state, socket, message) {
    const { callId } = message;
    if (!callId)
        return;
    const videoCall = state.videoCalls.get(callId);
    if (videoCall?.status === 'active') {
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
// ============================================================================
// MESSAGE HANDLING
// ============================================================================
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
        case 'END_GAME':
            await handleEndGame(state, socket);
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
// ============================================================================
// GAME RESUMPTION
// ============================================================================
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
        await resumeGame(state, ws, dbGame);
    }
    catch (error) {
        // Handle error silently
    }
}
async function resumeGame(state, ws, dbGame) {
    try {
        // 1. Fetch all moves from database
        const dbMoves = await prisma_1.prisma.move.findMany({
            where: { gameId: dbGame.id },
            orderBy: { moveNum: 'asc' }
        });
        // 2. Reconstruct the chess board from moves
        const chess = new chess_js_1.Chess();
        const moveHistory = [];
        for (const dbMove of dbMoves) {
            try {
                // Note: Database doesn't store promotion info, so we reconstruct from SAN
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
        // 3. Determine player colors and find opponent
        const isCurrentPlayerWhite = dbGame.playerWhiteId === ws.userId;
        const opponentUserId = isCurrentPlayerWhite ? dbGame.playerBlackId : dbGame.playerWhiteId;
        const opponentSocket = state.users.find(u => u.userId === opponentUserId);
        // 4. Find or create in-memory game (handle race conditions)
        let inMemoryGame = state.games.find(g => g.dbId === dbGame.id);
        if (!inMemoryGame) {
            // Create new in-memory game
            inMemoryGame = {
                // Always assign white to player1, black to player2
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
            // Update existing game with reconnected player
            if (isCurrentPlayerWhite) {
                inMemoryGame.player1 = ws;
            }
            else {
                inMemoryGame.player2 = ws;
            }
            inMemoryGame.waitingForOpponent = !opponentSocket;
        }
        // 5. Clear any pending disconnect timeout and restore game state
        if (disconnectTimeouts.has(dbGame.id)) {
            clearTimeout(disconnectTimeouts.get(dbGame.id));
            disconnectTimeouts.delete(dbGame.id);
        }
        // 6. Restore the game state for the reconnected player
        if (isCurrentPlayerWhite) {
            inMemoryGame.player1 = ws;
        }
        else {
            inMemoryGame.player2 = ws;
        }
        inMemoryGame.waitingForOpponent = !opponentSocket;
        // 7. Notify opponent that player has reconnected
        if (opponentSocket?.readyState === 1) {
            (0, utils_1.safeSend)(opponentSocket, { type: 'opponent_reconnected' });
        }
        // 8. Send resume game data to the reconnected player
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
// ============================================================================
// GAME ENDING
// ============================================================================
async function handleEndGame(state, socket) {
    if (!validateAuthentication(socket))
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
// ============================================================================
// CLEANUP
// ============================================================================
function cleanupAllTimeouts() {
    for (const [gameId, timeout] of Array.from(disconnectTimeouts.entries())) {
        clearTimeout(timeout);
    }
    disconnectTimeouts.clear();
}
//# sourceMappingURL=game-manager.js.map