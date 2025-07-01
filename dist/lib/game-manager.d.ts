import type { ServerWebSocket, WebSocketWithUserId, GameState, Move, VideoCallMessage, VideoCall } from '../types/game';
/**
 * Creates initial game state
 */
export declare function createGameState(): GameState & {
    videoCalls: Map<string, VideoCall>;
};
/**
 * Generates a random room ID
 */
export declare function generateRoomId(): string;
/**
 * Adds a new user to the game state
 */
export declare function addUser(state: GameState, socket: ServerWebSocket): void;
/**
 * Removes a user from the game state and cleans up associated games
 */
export declare function removeUser(state: GameState, socket: ServerWebSocket): void;
/**
 * Handles the INIT_GAME message - traditional multiplayer matchmaking
 */
export declare function handleInitGame(state: GameState, socket: WebSocketWithUserId): Promise<void>;
/**
 * Handles the SINGLE_PLAYER message - starts a single player game vs AI
 */
export declare function handleSinglePlayer(state: GameState, socket: ServerWebSocket): void;
/**
 * Handles the CREATE_ROOM message - creates a new room for multiplayer
 */
export declare function handleCreateRoom(state: GameState, socket: ServerWebSocket): void;
/**
 * Handles the JOIN_ROOM message - joins an existing room
 */
export declare function handleJoinRoom(state: GameState, socket: WebSocketWithUserId, roomId: string): Promise<void>;
/**
 * Handles the MOVE message - processes moves for both multiplayer and single player games
 */
export declare function handleMove(state: GameState, socket: ServerWebSocket, move: Move): Promise<void>;
/**
 * Handles video call messages
 */
export declare function handleVideoCallMessage(state: GameState & {
    videoCalls: Map<string, VideoCall>;
}, socket: ServerWebSocket, message: VideoCallMessage): void;
/**
 * Handles incoming messages from a WebSocket
 */
export declare function handleMessage(state: GameState & {
    videoCalls: Map<string, VideoCall>;
}, socket: ServerWebSocket, data: any): Promise<void>;
/**
 * Sets up message handler for a WebSocket
 */
export declare function setupMessageHandler(state: GameState & {
    videoCalls: Map<string, VideoCall>;
}, socket: ServerWebSocket): void;
export declare function resumeActiveGameForUser(state: GameState, ws: WebSocketWithUserId): Promise<void>;
export declare function handleEndGame(state: GameState, socket: ServerWebSocket): Promise<void>;
export declare function validateRoomId(roomId: string): boolean;
export declare function cleanupAllTimeouts(): void;
//# sourceMappingURL=game-manager.d.ts.map