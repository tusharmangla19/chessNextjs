import { Chess } from 'chess.js';
import type { ServerWebSocket, WebSocketWithUserId, GameState, MultiplayerGame, SinglePlayerGame, GameRoom, Move, VideoCallMessage, VideoCall, GameOverPayload } from '../types/game';
import { INIT_GAME, MOVE, GAME_OVER, ERROR, SINGLE_PLAYER, CREATE_ROOM, JOIN_ROOM, ROOM_CREATED, ROOM_JOINED, ROOM_NOT_FOUND, WAITING_FOR_OPPONENT, VIDEO_CALL_REQUEST, VIDEO_CALL_ACCEPTED, VIDEO_CALL_REJECTED, VIDEO_CALL_ENDED, VIDEO_OFFER, VIDEO_ANSWER, ICE_CANDIDATE } from '../types/game';
import { prisma } from './prisma';
import { safeSend } from './utils';

const END_GAME = 'END_GAME';

const moveRateLimit = new Map<string, number>();
const roomCreationLimit = new Map<string, number>();
const disconnectTimeouts = new Map<string, NodeJS.Timeout>();
const DISCONNECT_GRACE_MS = 1 * 60 * 1000; // 1 minute

// Simple locking mechanism to prevent race conditions
let isProcessingState = false;

/**
 * Creates initial game state
 */
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

/**
 * Generates a random room ID
 */
export function generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Adds a new user to the game state
 */
export function addUser(state: GameState, socket: ServerWebSocket): void {
    state.users.push(socket);
    console.log(`User connected. Total users: ${state.users.length}`);
}

/**
 * Removes a user from the game state and cleans up associated games
 */
export function removeUser(state: GameState, socket: ServerWebSocket): void {
    // Prevent race conditions by ensuring only one state modification at a time
    if (isProcessingState) {
        console.log('⚠️ State modification already in progress, queuing...');
        setTimeout(() => removeUser(state, socket), 100);
        return;
    }
    
    isProcessingState = true;
    
    try {
        console.log('🔄 removeUser called for socket:', (socket as WebSocketWithUserId).userId || 'unknown');
    state.users = state.users.filter(user => user !== socket);
    // Find all games this user is in
    const activeGames = state.games.filter(game => game.player1 === socket || game.player2 === socket);
        console.log('📊 Found active games for disconnected user:', activeGames.length);
        
    for (const game of activeGames) {
            console.log('🎮 Processing game:', game.dbId);
        // Mark this player as disconnected
        if (game.player1 === socket) {
            game.player1 = null as any;
                console.log('👤 Player 1 disconnected');
        }
        if (game.player2 === socket) {
            game.player2 = null as any;
                console.log('👤 Player 2 disconnected');
            }
            
            // Find the remaining connected player (opponent)
            const opponent = game.player1 || game.player2;
            if (opponent && opponent.readyState === 1 && typeof opponent.send === 'function') {
                console.log('📢 Notifying opponent about disconnect');
                try {
                    opponent.send(JSON.stringify({ 
                        type: 'opponent_disconnected',
                        payload: { gracePeriodMs: DISCONNECT_GRACE_MS }
                    }));
                } catch (error) {
                    console.error('Error sending disconnect notification:', error);
                }
            }
            
            // Schedule deletion after grace period (when any player disconnects)
            console.log('⏰ Player disconnected, scheduling deletion');
            if (!disconnectTimeouts.has(game.dbId)) {
                const timeout = setTimeout(async () => {
                    console.log('🗑️ Grace period expired, deleting game:', game.dbId);
                    // Notify any connected players that the game has ended
                    const allUsers = [game.player1, game.player2].filter(p => p && p.readyState === 1 && typeof p.send === 'function');
                    for (const user of allUsers) {
                        if (user) {
                            try {
                                user.send(JSON.stringify({ 
                                    type: 'game_ended_disconnect',
                                    payload: { message: "Game ended due to opponent disconnection" }
                                }));
                            } catch (error) {
                                console.error('Error sending game ended notification:', error);
                            }
                        }
                    }
                    
                    try {
                    await prisma.move.deleteMany({ where: { gameId: game.dbId } });
                    await prisma.game.delete({ where: { id: game.dbId } });
                    } catch (error) {
                        console.error('Error deleting game from database:', error);
                    }
                    
                    state.games = state.games.filter(g => g.dbId !== game.dbId);
                    disconnectTimeouts.delete(game.dbId);
                }, DISCONNECT_GRACE_MS);
                disconnectTimeouts.set(game.dbId, timeout);
            }
        }
        
        // Keep games in memory during grace period, only remove if both players are null
        // (This allows for reconnection during the grace period)
        state.games = state.games.filter(game => {
            // Keep game if at least one player is still connected or if there's an active timeout
            return (game.player1 !== null || game.player2 !== null) || disconnectTimeouts.has(game.dbId);
        });
    state.singlePlayerGames = state.singlePlayerGames.filter(game => game.player !== socket);
    // Clean up rooms
    state.rooms.forEach((room, roomId) => {
        if (room.player1 === socket || room.player2 === socket) {
            const opponent = room.player1 === socket ? room.player2 : room.player1;
            if (opponent) {
                safeSend(opponent, {
                    type: ERROR,
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
    console.log(`User disconnected. Total users: ${state.users.length}`);
    } finally {
        isProcessingState = false;
    }
}

/**
 * Handles the INIT_GAME message - traditional multiplayer matchmaking
 */
export async function handleInitGame(state: GameState, socket: WebSocketWithUserId): Promise<void> {
    // Validate that the socket has a userId (is authenticated)
    if (!socket.userId) {
        safeSend(socket, {
            type: ERROR,
            payload: { message: "Authentication required" }
        });
        return;
    }

    console.log(`INIT_GAME request. Pending user: ${state.pendingUser ? 'exists' : 'none'}`);
    if (!state.pendingUser) {
        state.pendingUser = socket;
        console.log('Setting pending user, waiting for opponent. userId:', socket.userId);
    } else {
        const player1 = state.pendingUser as WebSocketWithUserId;
        const player2 = socket;
        console.log('Pairing players:', player1.userId, player2.userId);
        state.pendingUser = null;
        // Persist game in DB
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
            dbId: dbGame.id // Store DB game ID
        };
        state.games.push(game);
        // Send game start to both players
        player1.send(JSON.stringify({
            type: INIT_GAME,
            payload: { color: 'white' }
        }));
        player2.send(JSON.stringify({
            type: INIT_GAME,
            payload: { color: 'black' }
        }));
        console.log('Multiplayer game created between two players. Sending INIT_GAME to both.');
    }
}

/**
 * Handles the SINGLE_PLAYER message - starts a single player game vs AI
 */
export function handleSinglePlayer(state: GameState, socket: ServerWebSocket): void {
    // Validate that the socket has a userId (is authenticated)
    const socketWithUserId = socket as WebSocketWithUserId;
    if (!socketWithUserId.userId) {
        safeSend(socket, {
            type: ERROR,
            payload: { message: "Authentication required" }
        });
        return;
    }

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

/**
 * Handles the CREATE_ROOM message - creates a new room for multiplayer
 */
export function handleCreateRoom(state: GameState, socket: ServerWebSocket): void {
    // Validate that the socket has a userId (is authenticated)
    const socketWithUserId = socket as WebSocketWithUserId;
    if (!socketWithUserId.userId) {
        safeSend(socket, {
            type: ERROR,
            payload: { message: "Authentication required" }
        });
        return;
    }

    const socketKey = socket.toString();
    const now = Date.now();
    const lastCreation = roomCreationLimit.get(socketKey) || 0;
    if (now - lastCreation < 5000) {
        safeSend(socket, {
            type: ERROR,
            payload: { message: "Please wait before creating another room" }
        });
        return;
    }
    roomCreationLimit.set(socketKey, now);
    const roomId = generateRoomId();
    const room: GameRoom = {
        id: roomId,
        player1: socket
    };
    state.rooms.set(roomId, room);
    safeSend(socket, {
        type: ROOM_CREATED,
        payload: { roomId }
    });
    safeSend(socket, {
        type: WAITING_FOR_OPPONENT
    });
}

/**
 * Handles the JOIN_ROOM message - joins an existing room
 */
export async function handleJoinRoom(state: GameState, socket: WebSocketWithUserId, roomId: string): Promise<void> {
    // Validate that the socket has a userId (is authenticated)
    if (!socket.userId) {
        safeSend(socket, {
            type: ERROR,
            payload: { message: "Authentication required" }
        });
        return;
    }

    const room = state.rooms.get(roomId);
    
    if (!room) {
        socket.send(JSON.stringify({
            type: ROOM_NOT_FOUND,
            payload: { message: "Room not found" }
        }));
        return;
    }
    
    if (room.player2) {
        socket.send(JSON.stringify({
            type: ERROR,
            payload: { message: "Room is full" }
        }));
        return;
    }
    
    room.player2 = socket;
    
    // Persist game in DB
    const player1 = room.player1 as WebSocketWithUserId;
    const player2 = room.player2 as WebSocketWithUserId;
    const dbGame = await prisma.game.create({
        data: {
            playerWhiteId: player1.userId,
            playerBlackId: player2.userId,
            status: 'ACTIVE',
        }
    });

    // Create game for the room
    const game: MultiplayerGame = {
        player1: room.player1,
        player2: room.player2,
        board: new Chess(),
        startTime: new Date(),
        moveCount: 0,
        dbId: dbGame.id // Store DB game ID
    };
    
    room.game = game;
    state.games.push(game);
    
    // Notify both players
    room.player1.send(JSON.stringify({
        type: ROOM_JOINED,
        payload: { color: 'white' }
    }));
    
    room.player2.send(JSON.stringify({
        type: ROOM_JOINED,
        payload: { color: 'black' }
    }));
}

/**
 * Handles the MOVE message - processes moves for both multiplayer and single player games
 */
export async function handleMove(state: GameState, socket: ServerWebSocket, move: Move): Promise<void> {
    // Validate that the socket has a userId (is authenticated)
    const socketWithUserId = socket as WebSocketWithUserId;
    if (!socketWithUserId.userId) {
        safeSend(socket, {
            type: ERROR,
            payload: { message: "Authentication required" }
        });
        return;
    }

    const playerId = socket.toString();
    const now = Date.now();
    const lastMove = moveRateLimit.get(playerId) || 0;
    if (now - lastMove < 1000) {
        safeSend(socket, {
            type: ERROR,
            payload: { message: "Move too fast. Please wait a moment." }
        });
        return;
    }
    moveRateLimit.set(playerId, now);
    let multiplayerGame = state.games.find(game => game.player1 === socket || game.player2 === socket);
    if (multiplayerGame) {
        // Validate that the user is actually a player in this game
        const isPlayer1 = multiplayerGame.player1 === socket;
        const isPlayer2 = multiplayerGame.player2 === socket;
        if (!isPlayer1 && !isPlayer2) {
            safeSend(socket, {
                type: ERROR,
                payload: { message: "You are not a player in this game" }
            });
            return;
        }

        // Only allow moves if both players are present
        if (!multiplayerGame.player1 || !multiplayerGame.player2) {
            safeSend(socket, {
                type: ERROR,
                payload: { message: "Waiting for opponent to reconnect." }
            });
            return;
        }
        try {
            // Validate turn
            const currentTurn = multiplayerGame.board.turn() === 'w' ? 'white' : 'black';
            const playerColor = multiplayerGame.player1 === socket ? 'white' : 'black';
            if (currentTurn !== playerColor) {
                safeSend(socket, {
                    type: ERROR,
                    payload: { message: "Not your turn" }
                });
                return;
            }
            // Pawn promotion validation
            const piece = multiplayerGame.board.get(move.from as any);
            const isPawn = piece?.type === 'p';
            const isLastRank = (piece?.color === 'w' && move.to[1] === '8') || (piece?.color === 'b' && move.to[1] === '1');
            if (isPawn && isLastRank) {
                if (!move.promotion || !['q','r','b','n'].includes(move.promotion)) {
                    safeSend(socket, {
                        type: ERROR,
                        payload: { message: "Promotion required: choose queen, rook, bishop, or knight." }
                    });
                    return;
                }
            }
            // Validate move without mutating board
            const testBoard = new Chess(multiplayerGame.board.fen());
            const moveResult = testBoard.move(move);
            if (!moveResult) {
                safeSend(socket, {
                    type: ERROR,
                    payload: { message: "Illegal move" }
                });
                return;
            }
            // Atomic DB + memory update
            await prisma.$transaction(async (tx) => {
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
                type: MOVE,
                payload: { move }
            };
            safeSend(opponent, moveMessage);
            safeSend(socket, moveMessage);
            // Game over check
            const gameOverResult = checkGameOver(multiplayerGame.board);
            if (gameOverResult.isOver) {
                const gameOverMessage = {
                    type: GAME_OVER,
                    payload: { 
                        winner: gameOverResult.winner,
                        reason: gameOverResult.reason
                    }
                };
                safeSend(multiplayerGame.player1, gameOverMessage);
                safeSend(multiplayerGame.player2, gameOverMessage);
                await prisma.game.update({
                    where: { id: multiplayerGame.dbId },
                    data: { status: 'COMPLETED' }
                });
                state.games = state.games.filter(g => g !== multiplayerGame);
            }
        } catch (error) {
            console.error("Move processing error:", error);
            safeSend(socket, {
                type: ERROR,
                payload: { message: "Move processing failed" }
            });
        }
        return;
    }
    // Single player games (apply similar validation)
    const singlePlayerGame = state.singlePlayerGames.find(game => game.player === socket);
    if (singlePlayerGame) {
        try {
            const piece = singlePlayerGame.board.get(move.from as any);
            const isPawn = piece?.type === 'p';
            const isLastRank = (piece?.color === 'w' && move.to[1] === '8') || (piece?.color === 'b' && move.to[1] === '1');
            if (isPawn && isLastRank) {
                if (!move.promotion || !['q','r','b','n'].includes(move.promotion)) {
                    safeSend(socket, {
                        type: ERROR,
                        payload: { message: "Promotion required: choose queen, rook, bishop, or knight." }
                    });
                    return;
                }
            }
            const legalMoves = singlePlayerGame.board.moves({ square: move.from as any, verbose: true });
            const isLegalMove = legalMoves.some((legalMove: any) => 
                legalMove.from === move.from && legalMove.to === move.to &&
                (!isPawn || !isLastRank || legalMove.promotion === move.promotion)
            );
            if (!isLegalMove) {
                safeSend(socket, {
                    type: ERROR,
                    payload: { message: "Illegal move" }
                });
                return;
            }
            singlePlayerGame.board.move(move);
            safeSend(socket, {
                type: MOVE,
                payload: { move }
            });
            const gameOverResult = checkGameOver(singlePlayerGame.board);
            if (gameOverResult.isOver) {
                const gameOverMessage = {
                    type: GAME_OVER,
                    payload: { 
                        winner: gameOverResult.winner,
                        reason: gameOverResult.reason
                    }
                };
                safeSend(singlePlayerGame.player, gameOverMessage);
                state.singlePlayerGames = state.singlePlayerGames.filter(g => g !== singlePlayerGame);
            }
        } catch (error) {
            console.error("Single player move validation error:", error);
            safeSend(socket, {
                type: ERROR,
                payload: { message: "Invalid move" }
            });
        }
        return;
    }
    safeSend(socket, {
        type: ERROR,
        payload: { message: "No active game found" }
    });
}

/**
 * Comprehensive game over detection
 */
function checkGameOver(board: Chess): { isOver: boolean; winner: string | null; reason: string } {
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
export function handleVideoCallMessage(state: GameState & { videoCalls: Map<string, VideoCall> }, socket: ServerWebSocket, message: VideoCallMessage): void {
    switch (message.type) {
        case VIDEO_CALL_REQUEST:
            handleVideoCallRequest(state, socket, message);
            break;
        case VIDEO_CALL_ACCEPTED:
            handleVideoCallAccepted(state, socket, message);
            break;
        case VIDEO_CALL_REJECTED:
            handleVideoCallRejected(state, socket, message);
            break;
        case VIDEO_CALL_ENDED:
            handleVideoCallEnded(state, socket, message);
            break;
        case VIDEO_OFFER:
        case VIDEO_ANSWER:
        case ICE_CANDIDATE:
            handleVideoSignaling(state, socket, message);
            break;
    }
}

/**
 * Handles video call request
 */
function handleVideoCallRequest(state: GameState & { videoCalls: Map<string, VideoCall> }, socket: ServerWebSocket, message: VideoCallMessage): void {
    const { payload } = message;
    const callId = payload?.callId;
    
    if (!callId) return;

    let targetUser: ServerWebSocket | null = null;
    
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
            } else if (room.player2 === socket && room.player1) {
                targetUser = room.player1;
            }
        });
    }
    
    if (targetUser) {
        const videoCall: VideoCall = {
            id: callId,
            initiator: socket,
            status: 'pending',
            startTime: new Date()
        };
        
        state.videoCalls.set(callId, videoCall);
        
        const forwardMessage = {
            type: VIDEO_CALL_REQUEST,
            payload: { callId },
            from: 'opponent',
            to: 'you'
        };
        
        targetUser.send(JSON.stringify(forwardMessage));
    } else {
        const errorMessage = {
            type: ERROR,
            payload: { message: "No opponent available for video call" }
        };
        socket.send(JSON.stringify(errorMessage));
    }
}

/**
 * Handles video call accepted
 */
function handleVideoCallAccepted(state: GameState & { videoCalls: Map<string, VideoCall> }, socket: ServerWebSocket, message: VideoCallMessage): void {
    const { payload } = message;
    const callId = payload?.callId;
    
    if (!callId) return;

    const videoCall = state.videoCalls.get(callId);
    
    if (videoCall && videoCall.initiator !== socket) {
        videoCall.receiver = socket;
        videoCall.status = 'active';
        
        videoCall.initiator.send(JSON.stringify({
            type: VIDEO_CALL_ACCEPTED,
            payload: { callId },
            from: 'opponent',
            to: 'you'
        }));
    }
}

/**
 * Handles video call rejected
 */
function handleVideoCallRejected(state: GameState & { videoCalls: Map<string, VideoCall> }, socket: ServerWebSocket, message: VideoCallMessage): void {
    const { payload } = message;
    const callId = payload?.callId;
    
    if (!callId) return;

    const videoCall = state.videoCalls.get(callId);
    
    if (videoCall) {
        videoCall.initiator.send(JSON.stringify({
            type: VIDEO_CALL_REJECTED,
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
function handleVideoCallEnded(state: GameState & { videoCalls: Map<string, VideoCall> }, socket: ServerWebSocket, message: VideoCallMessage): void {
    const { payload } = message;
    const callId = payload?.callId;
    
    if (!callId) return;

    const videoCall = state.videoCalls.get(callId);
    
    if (videoCall) {
        const otherParticipant = videoCall.initiator === socket ? videoCall.receiver : videoCall.initiator;
        
        if (otherParticipant) {
            otherParticipant.send(JSON.stringify({
                type: VIDEO_CALL_ENDED,
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
function handleVideoSignaling(state: GameState & { videoCalls: Map<string, VideoCall> }, socket: ServerWebSocket, message: VideoCallMessage): void {
    const { payload, callId } = message;
    
    if (!callId) return;

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
        case END_GAME:
            await handleEndGame(state, socket);
            break;
    }
}

/**
 * Sets up message handler for a WebSocket
 */
export function setupMessageHandler(state: GameState & { videoCalls: Map<string, VideoCall> }, socket: ServerWebSocket): void {
    socket.on("message", async (data) => {
        await handleMessage(state, socket, data);
    });
    socket.on('close', () => {
        removeUser(state, socket);
    });
}

export async function resumeActiveGameForUser(state: GameState, ws: WebSocketWithUserId): Promise<void> {
    if (!ws.userId) return;
    console.log('🔄 Attempting to resume game for user:', ws.userId);
    try {
        const dbGame = await prisma.game.findFirst({
            where: {
                status: 'ACTIVE',
                OR: [
                    { playerWhiteId: ws.userId },
                    { playerBlackId: ws.userId }
                ]
            }
        });
        if (!dbGame) {
            console.log('❌ No active game found for user:', ws.userId);
            return;
        }
        console.log('✅ Found active game:', dbGame.id);
        const dbMoves = await prisma.move.findMany({
            where: { gameId: dbGame.id },
            orderBy: { moveNum: 'asc' }
        });
        const chess = new Chess();
        const moveHistory = [];
        for (const m of dbMoves) {
            chess.move({ from: m.from, to: m.to });
            moveHistory.push({ from: m.from, to: m.to, san: m.san, fen: m.fen });
        }
        let inMemoryGame = state.games.find(g => g.dbId === dbGame.id);
        const isWhite = dbGame.playerWhiteId === ws.userId;
        const isBlack = dbGame.playerBlackId === ws.userId;
        const otherUserId = isWhite ? dbGame.playerBlackId : dbGame.playerWhiteId;
        const otherSocket = state.users.find(u => (u as WebSocketWithUserId).userId === otherUserId) as WebSocketWithUserId | undefined;
        
        console.log('👥 Other user ID:', otherUserId, 'Other socket found:', !!otherSocket);
        
        if (!inMemoryGame) {
            console.log('🆕 Creating new in-memory game');
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
        } else {
            console.log('🔄 Updating existing in-memory game');
            if (isWhite) inMemoryGame.player1 = ws;
            if (isBlack) inMemoryGame.player2 = ws;
            inMemoryGame.waitingForOpponent = !otherSocket;
        }
        // Cancel disconnect timeout if present
        if (disconnectTimeouts.has(dbGame.id)) {
            console.log('⏰ Cancelling disconnect timeout');
            clearTimeout(disconnectTimeouts.get(dbGame.id));
            disconnectTimeouts.delete(dbGame.id);
        }
        
        // Notify the other player that opponent has reconnected
        if (otherSocket && otherSocket.readyState === 1) {
            console.log('📢 Notifying other player about reconnection');
            otherSocket.send(JSON.stringify({ 
                type: 'opponent_reconnected'
            }));
        }
        
        const color = isWhite ? 'white' : 'black';
        console.log('🎮 Sending resume_game message to user:', ws.userId, 'color:', color);
        safeSend(ws, {
            type: 'resume_game',
            payload: {
                color,
                fen: chess.fen(),
                moveHistory,
                opponentConnected: !!otherSocket,
                waitingForOpponent: !otherSocket
            }
        });
    } catch (error) {
        console.error('Resume game error:', error);
    }
}

export async function handleEndGame(state: GameState, socket: ServerWebSocket): Promise<void> {
    // Validate that the socket has a userId (is authenticated)
    const socketWithUserId = socket as WebSocketWithUserId;
    if (!socketWithUserId.userId) {
        safeSend(socket, {
            type: ERROR,
            payload: { message: "Authentication required" }
        });
        return;
    }

    // Find the active game for this socket
    const gameIdx = state.games.findIndex(g => g.player1 === socket || g.player2 === socket);
    if (gameIdx === -1) return;
    const game = state.games[gameIdx];
    // Delete moves and game from DB
    if (game.dbId) {
        await prisma.move.deleteMany({ where: { gameId: game.dbId } });
        await prisma.game.delete({ where: { id: game.dbId } });
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
export function validateRoomId(roomId: string): boolean {
    return typeof roomId === 'string' && 
           roomId.length === 6 && 
           /^[A-Z0-9]+$/.test(roomId);
}

// Cleanup function to clear all timeouts (call this when server shuts down)
export function cleanupAllTimeouts(): void {
    console.log('🧹 Cleaning up all timeouts');
    for (const [gameId, timeout] of disconnectTimeouts.entries()) {
        clearTimeout(timeout);
        console.log(`Cleared timeout for game: ${gameId}`);
    }
    disconnectTimeouts.clear();
} 