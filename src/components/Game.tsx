'use client';

import { useEffect, useRef } from "react";
import { Chess } from 'chess.js';
import { useSocket } from "@/hooks/useSocket";
import { useVideoCall } from "@/hooks/useVideoCall";
import {
    useGameState,
    useGameMessages,
    useGameActions,
    GameMenu,
    WaitingScreen,
    GameBoard,
    GameNotifications,
    LoadingScreen
} from "./game/index";



export const Game = () => {
    const socket = useSocket();
    const chessRef = useRef(new Chess());
    
    // Game state management
    const gameState = useGameState();
    const {
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
        setRoomId,
        setErrorMessage,
        resetGame,
        showTemporaryError,
        setWaitingForOpponent
    } = gameState;
    
    console.log('[Game Render]', { isLoading, hasCheckedResume, gameMode });

    // Video call state
    const {
        videoCallState,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
        handleVideoMessage,
        localVideoRef,
        remoteVideoRef
    } = useVideoCall(socket, 'player', setErrorMessage);

    // Game actions
    const gameActions = useGameActions({
        socket,
        gameActions: gameState,
        roomId
    });

    // Initialize loading timeout
    useEffect(() => {
        if (socket) {
            gameState.setIsLoading(true);
            gameState.setHasCheckedResume(false);
        }
    }, [socket]);

    // Handle game messages
    useGameMessages({
        socket,
        chessRef,
        gameState,
        gameActions: gameState,
        handleVideoMessage
    });

    // Computed values
    const isGameDisabled = waitingForOpponent || !opponentConnected || opponentDisconnected;
    const opponentId = 'opponent';

    // Video call handlers
    const handleStartVideoCall = () => {
        if (started && opponentId) {
            startCall(opponentId);
        }
    };

    const handleAcceptIncomingCall = () => {
        if (incomingCall) {
            acceptCall(incomingCall.callId, incomingCall.from);
            gameState.setIncomingCall(null);
        }
    };

    const handleRejectIncomingCall = () => {
        if (incomingCall) {
            rejectCall(incomingCall.callId, incomingCall.from);
            gameState.setIncomingCall(null);
        }
    };

    const handleCopyRoomCode = () => {
        if (createdRoomId) {
            navigator.clipboard.writeText(createdRoomId);
        }
    };

    const handleCancelWaiting = () => {
        gameActions.cancelMatchmaking();
    };

    // Loading states - connecting to server
    if (!socket) {
        return <LoadingScreen title="Connecting to Server..." />;
    }

    // Loading states - loading game
    if (isLoading) {
        return <LoadingScreen title="Loading game..." />;
    }

    // Menu screen
    if (hasCheckedResume && gameMode === 'menu') {
        return (
            <GameMenu
                roomId={roomId}
                onRoomIdChange={setRoomId}
                onStartSinglePlayer={gameActions.startSinglePlayer}
                onStartMultiplayer={gameActions.startMultiplayer}
                onCreateRoom={gameActions.createRoom}
                onJoinRoom={gameActions.joinRoom}
                showTemporaryError={showTemporaryError}
            />
        );
    }

    // Waiting for opponent screen
    if (gameMode === 'multiplayer' && !started) {
        return (
            <WaitingScreen
                createdRoomId={createdRoomId}
                onCopyRoomCode={handleCopyRoomCode}
                onCancel={handleCancelWaiting}
            />
        );
    }

    // Main game screen
    return (
        <div className="h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-2 overflow-hidden">
            <GameNotifications
                errorMessage={errorMessage}
                incomingCall={incomingCall}
                onAcceptCall={handleAcceptIncomingCall}
                onRejectCall={handleRejectIncomingCall}
            />
            
            <GameBoard
                chess={chessRef.current}
                socket={socket}
                playerColor={playerColor}
                moveCount={moveCount}
                gameMode={gameMode}
                started={started}
                waitingForOpponent={waitingForOpponent}
                opponentConnected={opponentConnected}
                opponentDisconnected={opponentDisconnected}
                disconnectTimer={disconnectTimer}
                isGameDisabled={isGameDisabled}
                videoCallState={videoCallState}
                localVideoRef={localVideoRef}
                remoteVideoRef={remoteVideoRef}
                onStartVideoCall={handleStartVideoCall}
                onToggleMute={toggleMute}
                onToggleVideo={toggleVideo}
                onEndCall={endCall}
                setErrorMessage={setErrorMessage}
                onLeaveGame={gameActions.endGame}
            />
        </div>
    );
};