import { GameState, ServerWebSocket, WebSocketWithUserId, Move } from '../types/game';
export declare function createMultiplayerGame(state: GameState, player1: WebSocketWithUserId, player2: WebSocketWithUserId): Promise<void>;
export declare function handleSinglePlayer(state: GameState, socket: ServerWebSocket): void;
export declare function handleMove(state: GameState, socket: ServerWebSocket, move: Move): Promise<void>;
//# sourceMappingURL=game-core.d.ts.map