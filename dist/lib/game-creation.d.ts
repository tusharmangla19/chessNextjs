import type { GameState, WebSocketWithUserId, ServerWebSocket } from '../types/game';
export declare function handleInitGame(state: GameState, socket: WebSocketWithUserId): Promise<void>;
export declare function handleSinglePlayer(state: GameState, socket: ServerWebSocket): void;
export declare function handleCreateRoom(state: GameState, socket: ServerWebSocket): void;
export declare function handleJoinRoom(state: GameState, socket: WebSocketWithUserId, roomId: string): Promise<void>;
//# sourceMappingURL=game-creation.d.ts.map