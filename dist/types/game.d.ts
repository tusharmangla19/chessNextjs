import type ws from "ws";
import { Chess } from 'chess.js';
export type ServerWebSocket = ws;
export declare const INIT_GAME = "init_game";
export declare const MOVE = "move";
export declare const GAME_OVER = "game_over";
export declare const ERROR = "error";
export declare const SINGLE_PLAYER = "single_player";
export declare const CREATE_ROOM = "create_room";
export declare const JOIN_ROOM = "join_room";
export declare const ROOM_CREATED = "room_created";
export declare const ROOM_JOINED = "room_joined";
export declare const ROOM_NOT_FOUND = "room_not_found";
export declare const WAITING_FOR_OPPONENT = "waiting_for_opponent";
export declare const CANCEL_MATCHMAKING = "cancel_matchmaking";
export declare const MATCHMAKING_CANCELLED = "matchmaking_cancelled";
export declare const VIDEO_CALL_REQUEST = "video_call_request";
export declare const VIDEO_CALL_ACCEPTED = "video_call_accepted";
export declare const VIDEO_CALL_REJECTED = "video_call_rejected";
export declare const VIDEO_CALL_ENDED = "video_call_ended";
export declare const VIDEO_OFFER = "video_offer";
export declare const VIDEO_ANSWER = "video_answer";
export declare const ICE_CANDIDATE = "ice_candidate";
export interface Move {
    from: string;
    to: string;
    promotion?: 'q' | 'r' | 'b' | 'n';
}
export interface GameOverPayload {
    winner: string | null;
    reason: string;
}
export interface GameRoom {
    id: string;
    player1: ServerWebSocket;
    player2?: ServerWebSocket;
    game?: MultiplayerGame;
}
export interface MultiplayerGame {
    player1: ServerWebSocket | null;
    player2: ServerWebSocket | null;
    board: Chess;
    startTime: Date;
    moveCount: number;
    dbId: string;
    waitingForOpponent?: boolean;
}
export interface SinglePlayerGame {
    player: ServerWebSocket;
    board: Chess;
    startTime: Date;
}
export interface GameState {
    games: MultiplayerGame[];
    singlePlayerGames: SinglePlayerGame[];
    pendingUser: ServerWebSocket | null;
    users: ServerWebSocket[];
    rooms: Map<string, GameRoom>;
}
export interface VideoCallMessage {
    type: string;
    payload: any;
    from: string;
    to: string;
    callId?: string;
}
export interface VideoCall {
    id: string;
    initiator: ServerWebSocket;
    receiver?: ServerWebSocket;
    status: 'pending' | 'active' | 'ended';
    startTime: Date;
}
export interface WebSocketWithUserId extends ServerWebSocket {
    userId?: string;
    clerkId?: string;
}
//# sourceMappingURL=game.d.ts.map