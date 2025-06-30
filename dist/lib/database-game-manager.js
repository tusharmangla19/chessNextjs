"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGameState = createGameState;
exports.generateRoomId = generateRoomId;
exports.addUser = addUser;
exports.removeUser = removeUser;
exports.checkAndResumeGame = checkAndResumeGame;
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
// Database operations (we'll import these after generating Prisma client)
// import { 
//   createGame, 
//   updateGameState, 
//   createMove, 
//   getGameById,
//   getActiveGameByPlayerId,
//   completeGame
// } from './database';
// Rate limiting for moves
const moveRateLimit = new Map();
// Map to store user sessions with their database IDs
const userSessions = new Map();
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
function addUser(state, socket, userId) {
    state.users.push(socket);
    if (userId) {
        userSessions.set(socket, { userId });
    }
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
    // Clean up user session
    userSessions.delete(socket);
    console.log(`User disconnected. Total users: ${state.users.length}`);
}
/**
 * Checks if user has an active game and resumes it
 */
async function checkAndResumeGame(socket, userId) {
    try {
        // This would call the database to check for active games
        // const activeGame = await getActiveGameByPlayerId(userId);
        // if (activeGame) {
        //     // Resume the game
        //     const chess = new Chess(activeGame.boardState);
        //     const game: MultiplayerGame = {
        //         player1: socket,
        //         player2: null, // Will be set when opponent rejoins
        //         board: chess,
        //         startTime: activeGame.createdAt,
        //         moveCount: activeGame.moves.length,
        //         gameId: activeGame.id
        //     };
        //     
        //     userSessions.set(socket, { userId, gameId: activeGame.id });
        //     
        //     socket.send(JSON.stringify({
        //         type: INIT_GAME,
        //         payload: { 
        //             color: activeGame.player1Id === userId ? 'white' : 'black',
        //             gameId: activeGame.id,
        //             boardState: activeGame.boardState,
        //             currentTurn: activeGame.currentTurn
        //         }
        //     }));
        //     
        //     return true;
        // }
        return false;
    }
    catch (error) {
        console.error('Error checking for active game:', error);
        return false;
    }
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
    // Create a new game
    const game = {
        player1: room.player1,
        player2: room.player2,
        board: new chess_js_1.Chess(),
        startTime: new Date(),
        moveCount: 0
    };
    state.games.push(game);
    // Send game start to both players
    room.player1.send(JSON.stringify({
        type: game_1.ROOM_JOINED,
        payload: { roomId }
    }));
    room.player1.send(JSON.stringify({
        type: game_1.INIT_GAME,
        payload: { color: 'white' }
    }));
    room.player2.send(JSON.stringify({
        type: game_1.INIT_GAME,
        payload: { color: 'black' }
    }));
    // Remove the room since game has started
    state.rooms.delete(roomId);
}
/**
 * Handles the MOVE message - processes a chess move
 */
async function handleMove(state, socket, move) {
    // Rate limiting
    const now = Date.now();
    const lastMove = moveRateLimit.get(socket.toString());
    if (lastMove && now - lastMove < 100) { // 100ms rate limit
        return;
    }
    moveRateLimit.set(socket.toString(), now);
    // Find the game
    const game = state.games.find(g => g.player1 === socket || g.player2 === socket);
    if (!game) {
        socket.send(JSON.stringify({
            type: game_1.ERROR,
            payload: { message: "No active game found" }
        }));
        return;
    }
    // Validate turn
    const isPlayer1 = game.player1 === socket;
    const currentTurn = game.board.turn();
    if ((isPlayer1 && currentTurn === 'b') || (!isPlayer1 && currentTurn === 'w')) {
        socket.send(JSON.stringify({
            type: game_1.ERROR,
            payload: { message: "Not your turn" }
        }));
        return;
    }
    try {
        // Make the move
        const result = game.board.move(move);
        if (!result) {
            socket.send(JSON.stringify({
                type: game_1.ERROR,
                payload: { message: "Invalid move" }
            }));
            return;
        }
        game.moveCount++;
        // Save move to database if we have user session
        const userSession = userSessions.get(socket);
        if (userSession?.gameId) {
            try {
                // await createMove({
                //     gameId: userSession.gameId,
                //     playerId: userSession.userId,
                //     from: move.from,
                //     to: move.to,
                //     piece: result.piece,
                //     moveType: result.flags.includes('k') ? 'CASTLE' : 
                //               result.flags.includes('e') ? 'EN_PASSANT' : 
                //               result.flags.includes('q') ? 'PROMOTION' : 'NORMAL'
                // });
                // Update game state in database
                // await updateGameState(
                //     userSession.gameId,
                //     game.board.fen(),
                //     game.board.turn()
                // );
            }
            catch (error) {
                console.error('Error saving move to database:', error);
            }
        }
        // Send move to both players
        const movePayload = {
            from: move.from,
            to: move.to,
            piece: result.piece,
            color: isPlayer1 ? 'white' : 'black'
        };
        game.player1.send(JSON.stringify({
            type: game_1.MOVE,
            payload: movePayload
        }));
        if (game.player2) {
            game.player2.send(JSON.stringify({
                type: game_1.MOVE,
                payload: movePayload
            }));
        }
        // Check for game over
        const gameOver = checkGameOver(game.board);
        if (gameOver.isOver) {
            const gameOverPayload = {
                winner: gameOver.winner,
                reason: gameOver.reason
            };
            game.player1.send(JSON.stringify({
                type: game_1.GAME_OVER,
                payload: gameOverPayload
            }));
            if (game.player2) {
                game.player2.send(JSON.stringify({
                    type: game_1.GAME_OVER,
                    payload: gameOverPayload
                }));
            }
            // Save game completion to database
            if (userSession?.gameId) {
                try {
                    // await completeGame(
                    //     userSession.gameId,
                    //     gameOver.winner === 'white' ? 
                    //         (game.player1 === socket ? userSession.userId : null) :
                    //         (game.player2 === socket ? userSession.userId : null)
                    // );
                }
                catch (error) {
                    console.error('Error saving game completion:', error);
                }
            }
            // Remove game from state
            state.games = state.games.filter(g => g !== game);
        }
    }
    catch (error) {
        console.error('Error processing move:', error);
        socket.send(JSON.stringify({
            type: game_1.ERROR,
            payload: { message: "Error processing move" }
        }));
    }
}
/**
 * Checks if the game is over
 */
function checkGameOver(board) {
    if (board.isCheckmate()) {
        return {
            isOver: true,
            winner: board.turn() === 'w' ? 'black' : 'white',
            reason: 'checkmate'
        };
    }
    if (board.isDraw()) {
        return {
            isOver: true,
            winner: null,
            reason: 'draw'
        };
    }
    if (board.isStalemate()) {
        return {
            isOver: true,
            winner: null,
            reason: 'stalemate'
        };
    }
    if (board.isThreefoldRepetition()) {
        return {
            isOver: true,
            winner: null,
            reason: 'threefold repetition'
        };
    }
    if (board.isInsufficientMaterial()) {
        return {
            isOver: true,
            winner: null,
            reason: 'insufficient material'
        };
    }
    return {
        isOver: false,
        winner: null,
        reason: ''
    };
}
// Video call handling functions remain the same as in the original game-manager.ts
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
    const game = state.games.find(g => g.player1 === socket || g.player2 === socket);
    if (!game)
        return;
    const opponent = game.player1 === socket ? game.player2 : game.player1;
    if (!opponent)
        return;
    const videoCall = {
        id: Math.random().toString(36).substring(2, 8),
        initiator: socket,
        receiver: opponent,
        status: 'pending',
        startTime: new Date()
    };
    state.videoCalls.set(game.player1.toString() + game.player2.toString(), videoCall);
    opponent.send(JSON.stringify({
        type: game_1.VIDEO_CALL_REQUEST,
        payload: { from: socket.toString() }
    }));
}
function handleVideoCallAccepted(state, socket, message) {
    const game = state.games.find(g => g.player1 === socket || g.player2 === socket);
    if (!game)
        return;
    const opponent = game.player1 === socket ? game.player2 : game.player1;
    if (!opponent)
        return;
    opponent.send(JSON.stringify({
        type: game_1.VIDEO_CALL_ACCEPTED,
        payload: { from: socket.toString() }
    }));
}
function handleVideoCallRejected(state, socket, message) {
    const game = state.games.find(g => g.player1 === socket || g.player2 === socket);
    if (!game)
        return;
    const opponent = game.player1 === socket ? game.player2 : game.player1;
    if (!opponent)
        return;
    opponent.send(JSON.stringify({
        type: game_1.VIDEO_CALL_REJECTED,
        payload: { from: socket.toString() }
    }));
    // Remove video call
    state.videoCalls.delete(game.player1.toString() + game.player2.toString());
}
function handleVideoCallEnded(state, socket, message) {
    const game = state.games.find(g => g.player1 === socket || g.player2 === socket);
    if (!game)
        return;
    const opponent = game.player1 === socket ? game.player2 : game.player1;
    if (!opponent)
        return;
    opponent.send(JSON.stringify({
        type: game_1.VIDEO_CALL_ENDED,
        payload: { from: socket.toString() }
    }));
    // Remove video call
    state.videoCalls.delete(game.player1.toString() + game.player2.toString());
}
function handleVideoSignaling(state, socket, message) {
    const game = state.games.find(g => g.player1 === socket || g.player2 === socket);
    if (!game)
        return;
    const opponent = game.player1 === socket ? game.player2 : game.player1;
    if (!opponent)
        return;
    opponent.send(JSON.stringify({
        type: message.type,
        payload: message.payload
    }));
}
/**
 * Main message handler
 */
function handleMessage(state, socket, data) {
    try {
        const message = JSON.parse(data);
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
                handleMove(state, socket, message.payload);
                break;
            case game_1.VIDEO_CALL_REQUEST:
            case game_1.VIDEO_CALL_ACCEPTED:
            case game_1.VIDEO_CALL_REJECTED:
            case game_1.VIDEO_CALL_ENDED:
            case game_1.VIDEO_OFFER:
            case game_1.VIDEO_ANSWER:
            case game_1.ICE_CANDIDATE:
                handleVideoCallMessage(state, socket, message);
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    }
    catch (error) {
        console.error('Error handling message:', error);
        socket.send(JSON.stringify({
            type: game_1.ERROR,
            payload: { message: "Invalid message format" }
        }));
    }
}
/**
 * Sets up the message handler for a socket
 */
function setupMessageHandler(state, socket) {
    socket.on('message', (data) => {
        handleMessage(state, socket, data.toString());
    });
}
//# sourceMappingURL=database-game-manager.js.map