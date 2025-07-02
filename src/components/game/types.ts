// Message types
export const MESSAGE_TYPES = {
    INIT_GAME: "init_game",
    MOVE: "move",
    GAME_OVER: "game_over",
    ERROR: "error",
    SINGLE_PLAYER: "single_player",
    CREATE_ROOM: "create_room",
    JOIN_ROOM: "join_room",
    ROOM_CREATED: "room_created",
    ROOM_JOINED: "room_joined",
    ROOM_NOT_FOUND: "room_not_found",
    WAITING_FOR_OPPONENT: "waiting_for_opponent",
    RESUME_GAME: "resume_game",
    OPPONENT_LEFT: "opponent_left",
    OPPONENT_DISCONNECTED: "opponent_disconnected",
    OPPONENT_RECONNECTED: "opponent_reconnected",
    GAME_ENDED_DISCONNECT: "game_ended_disconnect",
    END_GAME: "END_GAME",
    CANCEL_MATCHMAKING: "cancel_matchmaking",
    MATCHMAKING_CANCELLED: "matchmaking_cancelled",
    NO_GAME_TO_RESUME: "no_game_to_resume"
} as const;

export const VIDEO_MESSAGE_TYPES = {
    VIDEO_CALL_REQUEST: "video_call_request",
    VIDEO_CALL_ACCEPTED: "video_call_accepted",
    VIDEO_CALL_REJECTED: "video_call_rejected",
    VIDEO_CALL_ENDED: "video_call_ended",
    VIDEO_OFFER: "video_offer",
    VIDEO_ANSWER: "video_answer",
    ICE_CANDIDATE: "ice_candidate"
} as const;

export const ALL_VIDEO_TYPES = Object.values(VIDEO_MESSAGE_TYPES);

export type GameMode = 'menu' | 'single_player' | 'multiplayer' | 'room_creator' | 'room_joiner';
export type PlayerColor = 'white' | 'black' | null;

export interface GameState {
    gameMode: GameMode;
    roomId: string;
    createdRoomId: string;
    started: boolean;
    playerColor: PlayerColor;
    moveCount: number;
    waitingForOpponent: boolean;
    opponentConnected: boolean;
    opponentDisconnected: boolean;
    disconnectTimer: number;
    errorMessage: string | null;
    isLoading: boolean;
    hasCheckedResume: boolean;
    incomingCall: { callId: string; from: string } | null;
}

export interface GameActions {
    setGameMode: (mode: GameMode) => void;
    setRoomId: (id: string) => void;
    setCreatedRoomId: (id: string) => void;
    setStarted: (started: boolean) => void;
    setPlayerColor: (color: PlayerColor) => void;
    setMoveCount: (count: number | ((prev: number) => number)) => void;
    setWaitingForOpponent: (waiting: boolean) => void;
    setOpponentConnected: (connected: boolean) => void;
    setOpponentDisconnected: (disconnected: boolean) => void;
    setDisconnectTimer: (timer: number) => void;
    setErrorMessage: (message: string | null) => void;
    setIsLoading: (loading: boolean) => void;
    setHasCheckedResume: (checked: boolean) => void;
    setIncomingCall: (call: { callId: string; from: string } | null) => void;
    resetGame: () => void;
    showTemporaryError: (message: string) => void;
    clearDisconnectTimer: () => void;
    startDisconnectTimer: () => void;
    stopLoading: () => void;
} 