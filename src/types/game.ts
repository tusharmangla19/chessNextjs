import { WebSocket } from "ws";
import { Chess } from 'chess.js';

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
}

export interface GameOverPayload {
    winner: string | null;
    reason: string;
}

export interface GameRoom {
    id: string;
    player1: WebSocket;
    player2?: WebSocket;
    game?: MultiplayerGame;
}

export interface MultiplayerGame {
    player1: WebSocket;
    player2: WebSocket;
    board: Chess;
    startTime: Date;
    moveCount: number;
}

export interface SinglePlayerGame {
    player: WebSocket;
    board: Chess;
    startTime: Date;
}

export interface GameState {
    games: MultiplayerGame[];
    singlePlayerGames: SinglePlayerGame[];
    pendingUser: WebSocket | null;
    users: WebSocket[];
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
    initiator: WebSocket;
    receiver?: WebSocket;
    status: 'pending' | 'active' | 'ended';
    startTime: Date;
} 