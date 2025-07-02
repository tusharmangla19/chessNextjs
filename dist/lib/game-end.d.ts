import type { GameState, ServerWebSocket } from '../types/game';
export declare function handleEndGame(state: GameState, socket: ServerWebSocket): Promise<void>;
export declare function cleanupAllTimeouts(): void;
export declare function handleCancelMatchmaking(state: GameState, socket: ServerWebSocket): void;
//# sourceMappingURL=game-end.d.ts.map