import { WebSocket } from "ws";
import { GameState, Move, VideoCallMessage, VideoCall } from '../types/game';
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
export declare function addUser(state: GameState, socket: WebSocket): void;
/**
 * Removes a user from the game state and cleans up associated games
 */
export declare function removeUser(state: GameState, socket: WebSocket): void;
/**
 * Handles the INIT_GAME message - traditional multiplayer matchmaking
 */
export declare function handleInitGame(state: GameState, socket: WebSocket): void;
/**
 * Handles the SINGLE_PLAYER message - starts a single player game vs AI
 */
export declare function handleSinglePlayer(state: GameState, socket: WebSocket): void;
/**
 * Handles the CREATE_ROOM message - creates a new room for multiplayer
 */
export declare function handleCreateRoom(state: GameState, socket: WebSocket): void;
/**
 * Handles the JOIN_ROOM message - joins an existing room
 */
export declare function handleJoinRoom(state: GameState, socket: WebSocket, roomId: string): void;
/**
 * Handles the MOVE message - processes moves for both multiplayer and single player games
 */
export declare function handleMove(state: GameState, socket: WebSocket, move: Move): void;
/**
 * Handles video call messages
 */
export declare function handleVideoCallMessage(state: GameState & {
    videoCalls: Map<string, VideoCall>;
}, socket: WebSocket, message: VideoCallMessage): void;
/**
 * Handles incoming messages from a WebSocket
 */
export declare function handleMessage(state: GameState & {
    videoCalls: Map<string, VideoCall>;
}, socket: WebSocket, data: any): void;
/**
 * Sets up message handler for a WebSocket
 */
export declare function setupMessageHandler(state: GameState & {
    videoCalls: Map<string, VideoCall>;
}, socket: WebSocket): void;
//# sourceMappingURL=game-manager.d.ts.map