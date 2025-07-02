import { useState, useRef, useEffect } from 'react';
import { Chess } from 'chess.js';
import { GameState, GameActions, GameMode, PlayerColor } from './types';

export const useGameState = (): GameState & GameActions => {
    const [gameMode, setGameMode] = useState<GameMode>('menu');
    const [roomId, setRoomId] = useState('');
    const [createdRoomId, setCreatedRoomId] = useState('');
    const [started, setStarted] = useState(false);
    const [playerColor, setPlayerColor] = useState<PlayerColor>(null);
    const [moveCount, setMoveCount] = useState(0);
    const [waitingForOpponent, setWaitingForOpponent] = useState(false);
    const [opponentConnected, setOpponentConnected] = useState(true);
    const [opponentDisconnected, setOpponentDisconnected] = useState(false);
    const [disconnectTimer, setDisconnectTimer] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasCheckedResume, setHasCheckedResume] = useState(false);
    const [incomingCall, setIncomingCall] = useState<{ callId: string; from: string } | null>(null);

    // Refs
    const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const disconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup disconnect timer on unmount
    useEffect(() => {
        return () => {
            if (disconnectTimerRef.current) {
                clearInterval(disconnectTimerRef.current);
            }
        };
    }, []);

    // Handle timer expiration
    useEffect(() => {
        if (disconnectTimer === 0 && opponentDisconnected) {
            // Don't reset game here - let the server handle it
            // The server will send GAME_ENDED_DISCONNECT when the timer expires
            setOpponentDisconnected(false);
            setErrorMessage('Game ended due to opponent disconnection.');
            setTimeout(() => setErrorMessage(null), 3000);
        }
    }, [disconnectTimer, opponentDisconnected]);

    const clearDisconnectTimer = () => {
        if (disconnectTimerRef.current) {
            clearInterval(disconnectTimerRef.current);
            disconnectTimerRef.current = null;
        }
    };

    const startDisconnectTimer = () => {
        setOpponentDisconnected(true);
        setDisconnectTimer(60);
        
        clearDisconnectTimer();
        
        disconnectTimerRef.current = setInterval(() => {
            setDisconnectTimer(prev => {
                if (prev <= 0) {
                    clearDisconnectTimer();
                    // Don't reset game here - let the server handle it
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const showTemporaryError = (message: string) => {
        setErrorMessage(message);
        setTimeout(() => setErrorMessage(null), 3000);
    };

    const resetGame = () => {
        setStarted(false);
        setPlayerColor(null);
        setGameMode('menu');
        setRoomId('');
        setCreatedRoomId('');
        setWaitingForOpponent(false);
        setOpponentDisconnected(false);
        setDisconnectTimer(0);
        clearDisconnectTimer();
    };

    const stopLoading = () => {
        setIsLoading(false);
        setHasCheckedResume(true);
        console.log('[GameState] stopLoading called: isLoading=false, hasCheckedResume=true');
    };

    return {
        // State
        gameMode,
        roomId,
        createdRoomId,
        started,
        playerColor,
        moveCount,
        waitingForOpponent,
        opponentConnected,
        opponentDisconnected,
        disconnectTimer,
        errorMessage,
        isLoading,
        hasCheckedResume,
        incomingCall,

        // Actions
        setGameMode,
        setRoomId,
        setCreatedRoomId,
        setStarted,
        setPlayerColor,
        setMoveCount,
        setWaitingForOpponent,
        setOpponentConnected,
        setOpponentDisconnected,
        setDisconnectTimer,
        setErrorMessage,
        setIsLoading,
        setHasCheckedResume,
        setIncomingCall,
        resetGame,
        showTemporaryError,
        clearDisconnectTimer,
        startDisconnectTimer,
        stopLoading,
    };
}; 