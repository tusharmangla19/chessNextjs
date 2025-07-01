import type { ServerWebSocket, WebSocketWithUserId, GameState, Move, VideoCallMessage, VideoCall } from '../types/game';
export declare function createGameState(): GameState & {
    videoCalls: Map<string, VideoCall>;
};
export declare function addUser(state: GameState, socket: ServerWebSocket): void;
export declare function removeUser(state: GameState, socket: ServerWebSocket): void;
export declare function generateRoomId(): string;
export declare function validateRoomId(roomId: string): boolean;
export declare function handleInitGame(state: GameState, socket: WebSocketWithUserId): Promise<void>;
export declare function handleSinglePlayer(state: GameState, socket: ServerWebSocket): void;
export declare function handleCreateRoom(state: GameState, socket: ServerWebSocket): void;
export declare function handleJoinRoom(state: GameState, socket: WebSocketWithUserId, roomId: string): Promise<void>;
export declare function handleMove(state: GameState, socket: ServerWebSocket, move: Move): Promise<void>;
export declare function handleVideoCallMessage(state: GameState & {
    videoCalls: Map<string, VideoCall>;
}, socket: ServerWebSocket, message: VideoCallMessage): void;
export declare function handleMessage(state: GameState & {
    videoCalls: Map<string, VideoCall>;
}, socket: ServerWebSocket, data: any): Promise<void>;
export declare function setupMessageHandler(state: GameState & {
    videoCalls: Map<string, VideoCall>;
}, socket: ServerWebSocket): void;
export declare function resumeActiveGameForUser(state: GameState, ws: WebSocketWithUserId): Promise<void>;
export declare function handleEndGame(state: GameState, socket: ServerWebSocket): Promise<void>;
export declare function cleanupAllTimeouts(): void;
//# sourceMappingURL=game-manager.d.ts.map