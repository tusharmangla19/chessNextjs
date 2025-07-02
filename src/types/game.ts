import type ws from "ws";
import { Chess } from 'chess.js';

export type ServerWebSocket = ws;

// Message types
export const INIT_GAME = "init_game";
export const MOVE = "move"; 
export const GAME_OVER = "game_over";
export const ERROR = "error";
export const SINGLE_PLAYER = "single_player";
export const CREATE_ROOM = "create_room";
export const JOIN_ROOM = "join_room";
export const ROOM_CREATED = "room_created";
export const ROOM_JOINED = "room_joined";
export const ROOM_NOT_FOUND = "room_not_found";
export const WAITING_FOR_OPPONENT = "waiting_for_opponent";
export const CANCEL_MATCHMAKING = "cancel_matchmaking";
export const MATCHMAKING_CANCELLED = "matchmaking_cancelled";

// Video call message types
export const VIDEO_CALL_REQUEST = "video_call_request";
export const VIDEO_CALL_ACCEPTED = "video_call_accepted";
export const VIDEO_CALL_REJECTED = "video_call_rejected";
export const VIDEO_CALL_ENDED = "video_call_ended";
export const VIDEO_OFFER = "video_offer";
export const VIDEO_ANSWER = "video_answer";
export const ICE_CANDIDATE = "ice_candidate";

// Game state interfaces
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

// Video call interfaces
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

// Extend WebSocket to allow userId property
export interface WebSocketWithUserId extends ServerWebSocket {
    userId?: string;
    clerkId?: string;
} 