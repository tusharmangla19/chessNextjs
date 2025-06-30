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
const chess_js_1 = require("chess.js");
const game_1 = require("../types/game");
// Rate limiting for moves
const moveRateLimit = new Map();
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
    state.games = state.games.filter(game => game.player1 !== socket && game.player2 !== socket);
    state.singlePlayerGames = state.singlePlayerGames.filter(game => game.player !== socket);
    // Remove from rooms
    state.rooms.forEach((room, roomId) => {
        if (room.player1 === socket) {
            if (room.player2) {
                room.player2.send(JSON.stringify({
                    type: game_1.ERROR,
                    payload: { message: "Opponent disconnected" }
                }));
            }
            state.rooms.delete(roomId);
        }
        else if (room.player2 === socket) {
            room.player1.send(JSON.stringify({
                type: game_1.ERROR,
                payload: { message: "Opponent disconnected" }
            }));
            state.rooms.delete(roomId);
        }
    });
    // Remove from pending
    if (state.pendingUser === socket) {
        state.pendingUser = null;
    }
    console.log(`User disconnected. Total users: ${state.users.length}`);
}
/**
 * Handles the INIT_GAME message - traditional multiplayer matchmaking
 */
function handleInitGame(state, socket) {
    console.log(`INIT_GAME request. Pending user: ${state.pendingUser ? 'exists' : 'none'}`);
    if (!state.pendingUser) {
        state.pendingUser = socket;
        console.log('Setting pending user, waiting for opponent');
    }
    else {
        // Create new game with two players
        const player1 = state.pendingUser;
        const player2 = socket;
        state.pendingUser = null;
        const game = {
            player1,
            player2,
            board: new chess_js_1.Chess(),
            startTime: new Date(),
            moveCount: 0
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
    const roomId = generateRoomId();
    const room = {
        id: roomId,
        player1: socket
    };
    state.rooms.set(roomId, room);
    socket.send(JSON.stringify({
        type: game_1.ROOM_CREATED,
        payload: { roomId }
    }));
    socket.send(JSON.stringify({
        type: game_1.WAITING_FOR_OPPONENT
    }));
}
/**
 * Handles the JOIN_ROOM message - joins an existing room
 */
function handleJoinRoom(state, socket, roomId) {
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
    // Create game for the room
    const game = {
        player1: room.player1,
        player2: room.player2,
        board: new chess_js_1.Chess(),
        startTime: new Date(),
        moveCount: 0
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
function handleMove(state, socket, move) {
    // Rate limiting: prevent moves faster than 1 per second
    const playerId = socket.toString();
    const now = Date.now();
    const lastMove = moveRateLimit.get(playerId) || 0;
    if (now - lastMove < 1000) {
        socket.send(JSON.stringify({
            type: game_1.ERROR,
            payload: { message: "Move too fast. Please wait a moment." }
        }));
        return;
    }
    moveRateLimit.set(playerId, now);
    // Check multiplayer games first
    let multiplayerGame = state.games.find(game => game.player1 === socket || game.player2 === socket);
    if (multiplayerGame) {
        // Handle multiplayer game with enhanced validation
        try {
            // Validate it's the player's turn
            const currentTurn = multiplayerGame.board.turn() === 'w' ? 'white' : 'black';
            const playerColor = multiplayerGame.player1 === socket ? 'white' : 'black';
            if (currentTurn !== playerColor) {
                socket.send(JSON.stringify({
                    type: game_1.ERROR,
                    payload: { message: "Not your turn" }
                }));
                return;
            }
            // Validate the move is legal
            const legalMoves = multiplayerGame.board.moves({ square: move.from, verbose: true });
            const isLegalMove = legalMoves.some((legalMove) => legalMove.from === move.from && legalMove.to === move.to);
            if (!isLegalMove) {
                socket.send(JSON.stringify({
                    type: game_1.ERROR,
                    payload: { message: "Illegal move" }
                }));
                return;
            }
            // Apply the move to server's game state
            multiplayerGame.board.move(move);
            multiplayerGame.moveCount++;
            // Send move to opponent (only after validation)
            const opponent = multiplayerGame.player1 === socket ? multiplayerGame.player2 : multiplayerGame.player1;
            opponent.send(JSON.stringify({
                type: game_1.MOVE,
                payload: { move }
            }));
            // Send move back to the player who made it (for confirmation)
            socket.send(JSON.stringify({
                type: game_1.MOVE,
                payload: { move }
            }));
            // Check for game over conditions
            const gameOverResult = checkGameOver(multiplayerGame.board);
            if (gameOverResult.isOver) {
                // Send game over message
                const gameOverMessage = {
                    type: game_1.GAME_OVER,
                    payload: {
                        winner: gameOverResult.winner,
                        reason: gameOverResult.reason
                    }
                };
                multiplayerGame.player1.send(JSON.stringify(gameOverMessage));
                multiplayerGame.player2.send(JSON.stringify(gameOverMessage));
                // Clean up multiplayer game
                state.games = state.games.filter(g => g !== multiplayerGame);
            }
        }
        catch (error) {
            console.error("Move validation error:", error);
            socket.send(JSON.stringify({
                type: game_1.ERROR,
                payload: { message: "Invalid move" }
            }));
        }
        return;
    }
    // Check single player games
    const singlePlayerGame = state.singlePlayerGames.find(game => game.player === socket);
    if (singlePlayerGame) {
        // Handle single player game with enhanced validation
        try {
            // Validate the move is legal
            const legalMoves = singlePlayerGame.board.moves({ square: move.from, verbose: true });
            const isLegalMove = legalMoves.some((legalMove) => legalMove.from === move.from && legalMove.to === move.to);
            if (!isLegalMove) {
                socket.send(JSON.stringify({
                    type: game_1.ERROR,
                    payload: { message: "Illegal move" }
                }));
                return;
            }
            // Apply the move to server's game state
            singlePlayerGame.board.move(move);
            // Send move back to the player (for confirmation)
            socket.send(JSON.stringify({
                type: game_1.MOVE,
                payload: { move }
            }));
            // Check for game over conditions
            const gameOverResult = checkGameOver(singlePlayerGame.board);
            if (gameOverResult.isOver) {
                // Send game over message
                const gameOverMessage = {
                    type: game_1.GAME_OVER,
                    payload: {
                        winner: gameOverResult.winner,
                        reason: gameOverResult.reason
                    }
                };
                singlePlayerGame.player.send(JSON.stringify(gameOverMessage));
                // Clean up single player game
                state.singlePlayerGames = state.singlePlayerGames.filter(g => g !== singlePlayerGame);
            }
        }
        catch (error) {
            console.error("Single player move validation error:", error);
            socket.send(JSON.stringify({
                type: game_1.ERROR,
                payload: { message: "Invalid move" }
            }));
        }
        return;
    }
    // No game found
    socket.send(JSON.stringify({
        type: game_1.ERROR,
        payload: { message: "No active game found" }
    }));
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
function handleMessage(state, socket, data) {
    const message = JSON.parse(data.toString());
    if ([game_1.VIDEO_CALL_REQUEST, game_1.VIDEO_CALL_ACCEPTED, game_1.VIDEO_CALL_REJECTED, game_1.VIDEO_CALL_ENDED, game_1.VIDEO_OFFER, game_1.VIDEO_ANSWER, game_1.ICE_CANDIDATE].includes(message.type)) {
        handleVideoCallMessage(state, socket, message);
        return;
    }
    switch (message.type) {
        case game_1.INIT_GAME:
            handleInitGame(state, socket);
            break;
        case game_1.SINGLE_PLAYER:
            handleSinglePlayer(state, socket);
            break;
        case game_1.CREATE_ROOM:
            handleCreateRoom(state, socket);
            break;
        case game_1.JOIN_ROOM:
            handleJoinRoom(state, socket, message.payload.roomId);
            break;
        case game_1.MOVE:
            handleMove(state, socket, message.payload.move);
            break;
    }
}
/**
 * Sets up message handler for a WebSocket
 */
function setupMessageHandler(state, socket) {
    socket.on("message", (data) => {
        handleMessage(state, socket, data);
    });
}
//# sourceMappingURL=game-manager.js.map