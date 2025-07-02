import { GameState, ServerWebSocket, GameRoom } from '../types/game';
export declare function createRoom(state: GameState, user: ServerWebSocket): GameRoom;
export declare function joinRoom(state: GameState, roomId: string, user: ServerWebSocket): boolean;
export declare function leaveRoom(state: GameState, roomId: string, user: ServerWebSocket): void;
//# sourceMappingURL=rooms.d.ts.map