import { GameState, MultiplayerGame, ServerWebSocket } from '../types/game';
export declare const DISCONNECT_GRACE_MS: number;
export declare function handlePlayerDisconnect(state: GameState, game: MultiplayerGame, socket: ServerWebSocket): void;
export declare function scheduleGameDeletion(state: GameState, game: MultiplayerGame): void;
export declare function deleteGame(state: GameState, game: MultiplayerGame): Promise<void>;
//# sourceMappingURL=disconnect.d.ts.map