import type { ServerWebSocket, WebSocketWithUserId, GameState, VideoCall } from '../types/game';
import { cleanupAllTimeouts } from './game-end';
import { resumeActiveGameForUser } from './game-resume';
export declare const DISCONNECT_GRACE_MS: number;
export declare const MOVE_RATE_LIMIT_MS = 1000;
export declare const ROOM_CREATION_RATE_LIMIT_MS = 5000;
export declare const moveRateLimit: Map<string, number>;
export declare const roomCreationLimit: Map<string, number>;
export declare const disconnectTimeouts: Map<string, NodeJS.Timeout>;
export declare let isProcessingState: boolean;
export declare function createGameState(): GameState & {
    videoCalls: Map<string, VideoCall>;
};
export declare function addUser(state: GameState, socket: ServerWebSocket): void;
export declare function removeUser(state: GameState, socket: ServerWebSocket): void;
export declare function cleanupUserState(state: GameState, socket: ServerWebSocket): void;
export declare function generateRoomId(): string;
export declare function validateRoomId(roomId: string): boolean;
export declare function checkRateLimit(map: Map<string, number>, key: string, limitMs: number): boolean;
export declare function validateAuthentication(socket: ServerWebSocket): WebSocketWithUserId | null;
export declare function handleMessage(state: GameState & {
    videoCalls: Map<string, VideoCall>;
}, socket: ServerWebSocket, data: any): Promise<void>;
export declare function setupMessageHandler(state: GameState & {
    videoCalls: Map<string, VideoCall>;
}, socket: ServerWebSocket): void;
export { resumeActiveGameForUser };
export { cleanupAllTimeouts };
//# sourceMappingURL=state-manager.d.ts.map