import { useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { MESSAGE_TYPES, VIDEO_MESSAGE_TYPES, ALL_VIDEO_TYPES } from './types';
import { GameState, GameActions } from './types';

interface UseGameMessagesProps {
    socket: WebSocket | null;
    chessRef: React.MutableRefObject<Chess>;
    gameState: GameState;
    gameActions: GameActions;
    handleVideoMessage: (message: any) => void;
}

export const useGameMessages = ({
    socket,
    chessRef,
    gameState,
    gameActions,
    handleVideoMessage
}: UseGameMessagesProps) => {
    const {
        setStarted,
        setPlayerColor,
        setWaitingForOpponent,
        setCreatedRoomId,
        setOpponentConnected,
        setOpponentDisconnected,
        setDisconnectTimer,
        setMoveCount,
        setGameMode,
        showTemporaryError,
        stopLoading,
        resetGame,
        clearDisconnectTimer,
        startDisconnectTimer,
        setIncomingCall,
        setHasCheckedResume
    } = gameActions;

    const handleVideoCallMessage = (message: any) => {
        handleVideoMessage(message);
        
        if (message.type === VIDEO_MESSAGE_TYPES.VIDEO_CALL_REQUEST) {
            setIncomingCall({
                callId: message.payload.callId,
                from: message.from
            });
        }
        
        if ([VIDEO_MESSAGE_TYPES.VIDEO_CALL_ACCEPTED, VIDEO_MESSAGE_TYPES.VIDEO_CALL_REJECTED].includes(message.type)) {
            setIncomingCall(null);
        }
    };

    const handleGameMessage = (message: any) => {
        console.log('[GameMessages] handleGameMessage called with:', message);
        switch (message.type) {
            case MESSAGE_TYPES.INIT_GAME:
                stopLoading();
                setStarted(true);
                setPlayerColor(message.payload.color);
                setWaitingForOpponent(false);
                setHasCheckedResume(true);
                break;

            case MESSAGE_TYPES.MOVE:
                try {
                    chessRef.current.move(message.payload.move);
                    setMoveCount((prev: number) => prev + 1);
                } catch (error) {
                    showTemporaryError("Error applying move from server");
                }
                break;

            case MESSAGE_TYPES.RESUME_GAME:
                const { color, fen, moveHistory, opponentConnected, waitingForOpponent } = message.payload;
                const chess = new Chess();
                
                if (fen) {
                    chess.load(fen);
                } else if (moveHistory?.length > 0) {
                    moveHistory.forEach((m: any) => {
                        chess.move({ 
                            from: m.from, 
                            to: m.to, 
                            promotion: m.san.endsWith('=Q') ? 'q' : undefined 
                        });
                    });
                }
                
                chessRef.current = chess;
                setPlayerColor(color);
                setStarted(true);
                setWaitingForOpponent(!!waitingForOpponent);
                setOpponentConnected(!!opponentConnected);
                setMoveCount(moveHistory ? moveHistory.length : 0);
                setGameMode('multiplayer');
                stopLoading();
                setHasCheckedResume(true);
                break;

            case MESSAGE_TYPES.GAME_OVER:
                const { winner, reason } = message.payload;
                const gameOverMessage = winner 
                    ? `Game Over! ${winner} wins by ${reason}!`
                    : `Game Over! Draw by ${reason}!`;
                showTemporaryError(gameOverMessage);
                stopLoading();
                break;

            case MESSAGE_TYPES.ERROR:
            case MESSAGE_TYPES.ROOM_NOT_FOUND:
                showTemporaryError(message.payload.message);
                stopLoading();
                setHasCheckedResume(true);
                break;

            case MESSAGE_TYPES.WAITING_FOR_OPPONENT:
                setWaitingForOpponent(true);
                stopLoading();
                setHasCheckedResume(true);
                break;

            case MESSAGE_TYPES.ROOM_CREATED:
                setCreatedRoomId(message.payload.roomId);
                setWaitingForOpponent(true);
                stopLoading();
                setHasCheckedResume(true);
                break;

            case MESSAGE_TYPES.ROOM_JOINED:
                setStarted(true);
                setPlayerColor(message.payload.color);
                setWaitingForOpponent(false);
                stopLoading();
                setHasCheckedResume(true);
                break;

            case MESSAGE_TYPES.OPPONENT_LEFT:
                showTemporaryError('Opponent left the match. Redirecting to menu...');
                setTimeout(() => {
                    resetGame();
                    stopLoading();
                }, 3000);
                break;

            case MESSAGE_TYPES.OPPONENT_DISCONNECTED:
                startDisconnectTimer();
                stopLoading();
                break;

            case MESSAGE_TYPES.OPPONENT_RECONNECTED:
                setOpponentDisconnected(false);
                setDisconnectTimer(0);
                clearDisconnectTimer();
                stopLoading();
                break;

            case MESSAGE_TYPES.GAME_ENDED_DISCONNECT:
                setOpponentDisconnected(false);
                setDisconnectTimer(0);
                clearDisconnectTimer();
                showTemporaryError('Game ended due to opponent disconnection. Redirecting to menu...');
                setTimeout(() => {
                    resetGame();
                    stopLoading();
                }, 3000);
                break;

            case MESSAGE_TYPES.MATCHMAKING_CANCELLED:
                // Server confirmed matchmaking was cancelled
                stopLoading();
                setHasCheckedResume(true);
                break;

            case MESSAGE_TYPES.NO_GAME_TO_RESUME:
                setHasCheckedResume(true);
                stopLoading();
                break;

            default:
                showTemporaryError(`[GameMessages] Unhandled message type: ${message.type}`);
                break;
        }
    };

    useEffect(() => {
        if (!socket) return;

        socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('[WebSocket] Received message from server:', message);
                if (ALL_VIDEO_TYPES.includes(message.type)) {
                    handleVideoCallMessage(message);
                } else {
                    handleGameMessage(message);
                }
            } catch (error) {
                showTemporaryError("Error processing server message");
            }
        };
    }, [socket, handleVideoMessage]);
}; 