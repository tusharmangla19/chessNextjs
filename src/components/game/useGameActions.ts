import { MESSAGE_TYPES } from './types';
import { GameActions } from './types';

interface UseGameActionsProps {
    socket: WebSocket | null;
    gameActions: GameActions;
    roomId: string;
}

export const useGameActions = ({
    socket,
    gameActions,
    roomId
}: UseGameActionsProps) => {
    const {
        setGameMode,
        setRoomId,
        showTemporaryError,
        resetGame
    } = gameActions;

    const startSinglePlayer = () => {
        if (socket) {
            socket.send(JSON.stringify({ type: MESSAGE_TYPES.SINGLE_PLAYER }));
            setGameMode('single_player');
        }
    };

    const startMultiplayer = () => {
        if (socket) {
            socket.send(JSON.stringify({ type: MESSAGE_TYPES.INIT_GAME }));
            setGameMode('multiplayer');
        }
    };

    const createRoom = () => {
        if (socket) {
            socket.send(JSON.stringify({ type: MESSAGE_TYPES.CREATE_ROOM }));
            setGameMode('room_creator');
        }
    };

    const joinRoom = () => {
        if (!socket || !roomId.trim()) return;
        
        const cleanRoomId = roomId.trim().toUpperCase();
        if (!/^[A-Z0-9]{6}$/.test(cleanRoomId)) {
            showTemporaryError("Room code must be 6 characters (letters and numbers)");
            return;
        }
        
        socket.send(JSON.stringify({
            type: MESSAGE_TYPES.JOIN_ROOM,
            payload: { roomId: cleanRoomId }
        }));
        setGameMode('room_joiner');
    };

    const cancelMatchmaking = () => {
        if (socket) {
            socket.send(JSON.stringify({ type: MESSAGE_TYPES.CANCEL_MATCHMAKING }));
        }
        resetGame();
    };

    const endGame = () => {
        if (socket) {
            socket.send(JSON.stringify({ type: MESSAGE_TYPES.END_GAME }));
            resetGame();
        }
    };

    const copyRoomCode = (createdRoomId: string) => {
        if (createdRoomId) {
            navigator.clipboard.writeText(createdRoomId);
        }
    };

    return {
        startSinglePlayer,
        startMultiplayer,
        createRoom,
        joinRoom,
        cancelMatchmaking,
        endGame,
        copyRoomCode
    };
}; 