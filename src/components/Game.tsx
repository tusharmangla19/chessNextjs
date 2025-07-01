'use client';

import { useEffect, useState, useRef } from "react";
import { Button } from "./Button"
import { ChessBoard } from "./ChessBoard"
import { VideoCallButton } from "./VideoCallButton"
import { useSocket } from "@/hooks/useSocket";
import { useVideoCall } from "@/hooks/useVideoCall";
import { Chess } from 'chess.js'
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Copy, Users, Bot, Home } from "lucide-react";

// Message types
const MESSAGE_TYPES = {
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
    END_GAME: "END_GAME"
};

const VIDEO_MESSAGE_TYPES = {
    VIDEO_CALL_REQUEST: "video_call_request",
    VIDEO_CALL_ACCEPTED: "video_call_accepted",
    VIDEO_CALL_REJECTED: "video_call_rejected",
    VIDEO_CALL_ENDED: "video_call_ended",
    VIDEO_OFFER: "video_offer",
    VIDEO_ANSWER: "video_answer",
    ICE_CANDIDATE: "ice_candidate"
};

const ALL_VIDEO_TYPES = Object.values(VIDEO_MESSAGE_TYPES);

type GameMode = 'menu' | 'single_player' | 'multiplayer' | 'room_creator' | 'room_joiner';

export const Game = () => {
    const socket = useSocket();
    const chessRef = useRef(new Chess());
    
    // Game state
    const [gameMode, setGameMode] = useState<GameMode>('menu');
    const [roomId, setRoomId] = useState('');
    const [createdRoomId, setCreatedRoomId] = useState('');
    const [started, setStarted] = useState(false);
    const [playerColor, setPlayerColor] = useState<'white' | 'black' | null>(null);
    const [moveCount, setMoveCount] = useState(0);
    
    // Connection state
    const [waitingForOpponent, setWaitingForOpponent] = useState(false);
    const [opponentConnected, setOpponentConnected] = useState(true);
    const [opponentDisconnected, setOpponentDisconnected] = useState(false);
    const [disconnectTimer, setDisconnectTimer] = useState<number>(0);
    
    // UI state
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasCheckedResume, setHasCheckedResume] = useState(false);
    
    // Video call state
    const [incomingCall, setIncomingCall] = useState<{ callId: string; from: string } | null>(null);
    const [opponentId] = useState<string>('opponent');
    
    // Refs
    const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const disconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

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

    // Computed values
    const currentTurn = chessRef.current.turn() === 'w' ? 'white' : 'black';
    const isPlayerTurn = playerColor === currentTurn;
    const moveHistory = chessRef.current.history();
    const isGameDisabled = waitingForOpponent || !opponentConnected || opponentDisconnected;

    // Initialize loading timeout
    useEffect(() => {
        setIsLoading(true);
        setHasCheckedResume(false);
        
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = setTimeout(() => {
            setIsLoading(false);
            setHasCheckedResume(true);
        }, 1000);

        return () => {
            if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        };
    }, [socket]);

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
            setOpponentDisconnected(false);
            setErrorMessage('Game ended due to opponent disconnection.');
            setTimeout(() => setErrorMessage(null), 3000);
            resetGame();
        }
    }, [disconnectTimer, opponentDisconnected]);

    // Utility functions
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
        chessRef.current = new Chess();
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
    };

    // Message handlers
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
        switch (message.type) {
            case MESSAGE_TYPES.INIT_GAME:
                stopLoading();
                setStarted(true);
                setPlayerColor(message.payload.color);
                setWaitingForOpponent(false);
                break;

            case MESSAGE_TYPES.MOVE:
                try {
                    chessRef.current.move(message.payload.move);
                    setMoveCount(prev => prev + 1);
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
                break;

            case MESSAGE_TYPES.GAME_OVER:
                const { winner, reason } = message.payload;
                const gameOverMessage = winner 
                    ? `Game Over! ${winner} wins by ${reason}!`
                    : `Game Over! Draw by ${reason}!`;
                setErrorMessage(gameOverMessage);
                stopLoading();
                break;

            case MESSAGE_TYPES.ERROR:
            case MESSAGE_TYPES.ROOM_NOT_FOUND:
                showTemporaryError(message.payload.message);
                stopLoading();
                break;

            case MESSAGE_TYPES.WAITING_FOR_OPPONENT:
                setWaitingForOpponent(true);
                stopLoading();
                break;

            case MESSAGE_TYPES.ROOM_CREATED:
                setCreatedRoomId(message.payload.roomId);
                setWaitingForOpponent(true);
                stopLoading();
                break;

            case MESSAGE_TYPES.ROOM_JOINED:
                setStarted(true);
                setPlayerColor(message.payload.color);
                setWaitingForOpponent(false);
                stopLoading();
                break;

            case MESSAGE_TYPES.OPPONENT_LEFT:
                showTemporaryError('Opponent left the match. Redirecting to menu...');
                setTimeout(() => {
                    resetGame();
                    stopLoading();
                }, 3000); // Wait 3 seconds so the error is visible
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
                    }, 3000); // Wait 3 seconds so the error is visible
                    break;
        }
    };

    // WebSocket message handler
    useEffect(() => {
        if (!socket) return;

        socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

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

    // Game action handlers
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
            setWaitingForOpponent(true);
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

    const endGame = () => {
        if (socket) {
            socket.send(JSON.stringify({ type: MESSAGE_TYPES.END_GAME }));
            resetGame();
        }
    };

    // Video call handlers
    const handleStartVideoCall = () => {
        if (started && opponentId) {
            startCall(opponentId);
        }
    };

    const handleAcceptIncomingCall = () => {
        if (incomingCall) {
            acceptCall(incomingCall.callId, incomingCall.from);
            setIncomingCall(null);
        }
    };

    const handleRejectIncomingCall = () => {
        if (incomingCall) {
            rejectCall(incomingCall.callId, incomingCall.from);
            setIncomingCall(null);
        }
    };

    const copyRoomCode = () => {
        if (createdRoomId) {
            navigator.clipboard.writeText(createdRoomId);
        }
    };

    // Render helpers

    // Game status (Disconnect timer)
    const renderGameStatus = () => {
        if (opponentDisconnected) {
            return (
                <div className="space-y-2">
                    <Badge variant="danger" className="text-sm px-3 py-1">
                        Opponent Disconnected
                    </Badge>
                    <div className="text-white text-lg font-bold">
                        {Math.floor(disconnectTimer / 60)}:{(disconnectTimer % 60).toString().padStart(2, '0')}
                    </div>
                    <div className="text-gray-400 text-xs">
                        Reconnecting... Game will end in {disconnectTimer} seconds
                    </div>
                </div>
            );
        }

        return (
            <Badge 
                variant={isPlayerTurn ? "success" : "secondary"}
                className="text-sm px-3 py-1"
            >
                {gameMode === 'single_player' ? 
                    (isPlayerTurn ? 'Your Turn' : "AI's Turn") : 
                    (isPlayerTurn ? 'Your Turn' : "Opponent's Turn")
                }
            </Badge>
        );
    };

    const renderGameOverStatus = () => {
        if (chessRef.current.isCheckmate()) {
            return (
                <Card className="bg-red-600 border-red-500">
                    <CardContent className="p-2 text-center">
                        <div className="text-sm font-bold text-white">Checkmate!</div>
                        <div className="text-xs text-white">{currentTurn === 'white' ? 'Black' : 'White'} wins!</div>
                    </CardContent>
                </Card>
            );
        }

        if (chessRef.current.isDraw() && !chessRef.current.isCheckmate()) {
            let drawReason = '';
            if (chessRef.current.isStalemate()) drawReason = 'Stalemate';
            else if (chessRef.current.isThreefoldRepetition()) drawReason = 'Threefold Repetition';
            else if (chessRef.current.isInsufficientMaterial()) drawReason = 'Insufficient Material';
            else drawReason = 'Fifty-Move Rule';

            return (
                <Card className="bg-yellow-600 border-yellow-500">
                    <CardContent className="p-2 text-center">
                        <div className="text-sm font-bold text-white">Draw!</div>
                        <div className="text-xs text-white">{drawReason}</div>
                    </CardContent>
                </Card>
            );
        }

        if (chessRef.current.isCheck()) {
            return (
                <Card className="bg-orange-600 border-orange-500">
                    <CardContent className="p-2 text-center">
                        <div className="text-sm font-bold text-white">Check!</div>
                    </CardContent>
                </Card>
            );
        }

        if (chessRef.current.isGameOver()) {
            return (
                <Card className="bg-gray-600 border-gray-500">
                    <CardContent className="p-2 text-center">
                        <div className="text-sm font-bold text-white">Game Over</div>
                        <div className="text-xs text-white">No more moves allowed</div>
                    </CardContent>
                </Card>
            );
        }

        return null;
    };

    const renderVideoCall = () => {
        if (!videoCallState.isInCall) return null;

        return (
            <div className="mt-2">
                <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                    <CardHeader className="pb-1">
                        <CardTitle className="text-white text-center text-sm">Video Call</CardTitle>
                        {!videoCallState.isCallActive && (
                            <p className="text-xs text-gray-400 text-center">Connecting...</p>
                        )}
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="flex justify-center space-x-2">
                            <div className="relative">
                                <video
                                    ref={remoteVideoRef}
                                    autoPlay
                                    playsInline
                                    className="w-40 h-30 bg-slate-700 rounded-lg object-cover"
                                    muted={false}
                                />
                                {!videoCallState.remoteStream && (
                                    <div className="absolute inset-0 bg-slate-700 rounded-lg flex items-center justify-center">
                                        <div className="text-white text-center">
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto mb-1"></div>
                                            <p className="text-xs">Waiting...</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="relative">
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    playsInline
                                    muted={true}
                                    className="w-40 h-30 bg-slate-700 rounded-lg object-cover"
                                />
                                {!videoCallState.isVideoEnabled && (
                                    <div className="absolute inset-0 bg-slate-600 rounded-lg flex items-center justify-center">
                                        <span className="text-white text-xs">Camera Off</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex justify-center space-x-2 mt-2">
                            <Button
                                onClick={toggleMute}
                                variant={videoCallState.isMuted ? "danger" : "secondary"}
                                size="icon"
                                className="h-7 w-7"
                            >
                                {videoCallState.isMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                            </Button>
                            
                            <Button
                                onClick={toggleVideo}
                                variant={!videoCallState.isVideoEnabled ? "danger" : "secondary"}
                                size="icon"
                                className="h-7 w-7"
                            >
                                {videoCallState.isVideoEnabled ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
                            </Button>
                            
                            <Button
                                onClick={endCall}
                                variant="danger"
                                size="icon"
                                className="h-7 w-7"
                            >
                                <PhoneOff className="h-3 w-3" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    };

    // Loading states - connecting to server
    if (!socket) {
        return (
            <div className="h-screen flex justify-center items-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
                <Card className="w-96">
                    <CardHeader>
                        <CardTitle className="text-center">Connecting to Server...</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Loading states - loading game
    if (isLoading) {
        return (
            <div className="h-screen flex justify-center items-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
                <Card className="w-96">
                    <CardHeader>
                        <CardTitle className="text-center">Loading game...</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Menu screen
    if (hasCheckedResume && gameMode === 'menu') {
        return (
            <div className="h-screen flex justify-center items-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
                <Card className="w-96 bg-white/10 backdrop-blur-lg border-white/20">
                    <CardHeader>
                        <CardTitle className="text-center text-white text-3xl">♔ ChessMaster ♔</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button onClick={startSinglePlayer} variant="gradient" size="xl" className="w-full">
                            <Bot className="mr-2 h-5 w-5" />
                            Play vs AI
                        </Button>
                        
                        <Button onClick={startMultiplayer} variant="outline" size="xl" className="w-full border-white/20 text-white hover:bg-white/10">
                            <Users className="mr-2 h-5 w-5" />
                            Find Opponent
                        </Button>
                        
                        <Button onClick={createRoom} variant="outline" size="xl" className="w-full border-white/20 text-white hover:bg-white/10">
                            <Home className="mr-2 h-5 w-5" />
                            Create Room
                        </Button>
                        
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                placeholder="Enter Room Code"
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value)}
                                className="flex-1 px-3 py-2 bg-white/10 text-white rounded border border-white/20 focus:outline-none focus:border-purple-500 placeholder-gray-400"
                                maxLength={6}
                            />
                            <Button onClick={joinRoom} disabled={!roomId.trim()} variant="success" size="default">
                                Join
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Waiting for opponent screen
    if (waitingForOpponent && !started) {
        return (
            <div className="h-screen flex justify-center items-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
                <Card className="w-96 bg-white/10 backdrop-blur-lg border-white/20">
                    <CardHeader>
                        <CardTitle className="text-center text-white">Waiting for opponent...</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
                        
                        {createdRoomId && (
                            <Card className="bg-white/10 border-white/20">
                                <CardContent className="pt-6">
                                    <p className="text-gray-300 text-sm mb-2">Room Code:</p>
                                    <div className="flex items-center justify-center space-x-2">
                                        <p className="text-white text-2xl font-mono font-bold">{createdRoomId}</p>
                                        <Button onClick={copyRoomCode} variant="ghost" size="sm" className="text-white hover:bg-white/10">
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <p className="text-gray-400 text-xs mt-2">Share this code with your friend</p>
                                </CardContent>
                            </Card>
                        )}
                        
                        <Button onClick={resetGame} variant="outline" className="border-white/20 text-white hover:bg-white/10">
                            Cancel
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Main game screen
    return (
        <div className="h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-2 overflow-hidden">
            {/* Error Message */}
            {errorMessage && (
                <div className="fixed top-2 right-2 z-50">
                    <Card className="bg-red-600 border-red-500 text-white">
                        <CardContent className="p-3">
                            <div className="flex items-center">
                                <span className="mr-2">⚠️</span>
                                {errorMessage}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Incoming Call Notification */}
            {incomingCall && (
                <div className="fixed top-2 left-2 z-50">
                    <Card className="bg-blue-600 border-blue-500 text-white">
                        <CardContent className="p-3">
                            <div className="flex items-center space-x-2">
                                <span>📞</span>
                                <span>Incoming call from {incomingCall.from}</span>
                                <Button onClick={handleAcceptIncomingCall} variant="success" size="sm">
                                    Accept
                                </Button>
                                <Button onClick={handleRejectIncomingCall} variant="danger" size="sm">
                                    Decline
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
            
            <div className="h-full max-w-7xl mx-auto flex flex-col">
                {/* Desktop Layout */}
                <div className="hidden md:flex gap-4 flex-1">
                    <div className="flex-1 flex justify-center items-start">
                        {isGameDisabled && (
                            <div className="p-4 text-center text-lg font-semibold text-yellow-700 bg-yellow-100 rounded-lg mb-4">
                                Waiting for opponent to connect...
                            </div>
                        )}
                        <div className="flex flex-col items-center">
                            <div className={`bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 ${
                                videoCallState.isInCall ? 'p-3' : 'p-4'
                            }`}>
                                <ChessBoard 
                                    chess={chessRef.current} 
                                    socket={socket} 
                                    playerColor={playerColor}
                                    moveCount={moveCount}
                                    isVideoCallActive={videoCallState.isInCall}
                                    disableMoves={isGameDisabled}
                                    setErrorMessage={setErrorMessage}
                                />
                            </div>
                            
                            {started && gameMode !== 'single_player' && !videoCallState.isInCall && (
                                <div className="mt-4">
                                    <VideoCallButton
                                        onClick={handleStartVideoCall}
                                        disabled={!started}
                                        isInCall={false}
                                        className="w-48"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Sidebar */}
                    <div className={`space-y-2 ${videoCallState.isInCall ? 'w-60' : 'w-72'}`}>
                        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                            <CardHeader className="pb-1">
                                <CardTitle className="text-white text-center text-sm">Game Status</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="text-center">
                                    {renderGameStatus()}
                                </div>
                            </CardContent>
                        </Card>
                        
                        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                            <CardHeader className="pb-1">
                                <CardTitle className="text-white text-xs">Game Info:</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 space-y-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-300 text-xs">You are playing as:</span>
                                    <div className={`text-sm font-bold ${playerColor === 'white' ? 'text-white' : 'text-gray-300'}`}>
                                        {playerColor === 'white' ? '⚪ White' : '⚫ Black'}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-300 text-xs">Move count:</span>
                                    <span className="text-sm text-white font-mono">{moveCount}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-300 text-xs">Game mode:</span>
                                    <span className="text-sm text-white font-mono capitalize">{gameMode.replace('_', ' ')}</span>
                                </div>
                            </CardContent>
                        </Card>
                        {renderGameOverStatus()}
                        {renderVideoCall()}
                    </div>
                </div>
                {/* Mobile Layout */}
                <div className="flex md:hidden flex-col flex-1 gap-2">
                    <div className="flex-1 flex flex-col items-center">
                        <div className={`bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 ${videoCallState.isInCall ? 'p-2' : 'p-3'}`}> 
                            <ChessBoard
                                chess={chessRef.current}
                                socket={socket}
                                playerColor={playerColor}
                                moveCount={moveCount}
                                isVideoCallActive={videoCallState.isInCall}
                                disableMoves={isGameDisabled}
                                setErrorMessage={setErrorMessage}
                            />
                        </div>
                        {started && gameMode !== 'single_player' && !videoCallState.isInCall && (
                            <div className="mt-2 w-full flex justify-center">
                                <VideoCallButton
                                    onClick={handleStartVideoCall}
                                    disabled={!started}
                                    isInCall={false}
                                    className="w-full"
                                />
                            </div>
                        )}
                    </div>
                    <div className="space-y-2 mt-2">
                        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                            <CardHeader className="pb-1">
                                <CardTitle className="text-white text-center text-sm">Game Status</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="text-center">
                                    {renderGameStatus()}
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                            <CardHeader className="pb-1">
                                <CardTitle className="text-white text-xs">Game Info:</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 space-y-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-300 text-xs">You are playing as:</span>
                                    <div className={`text-sm font-bold ${playerColor === 'white' ? 'text-white' : 'text-gray-300'}`}>{playerColor === 'white' ? '⚪ White' : '⚫ Black'}</div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-300 text-xs">Move count:</span>
                                    <span className="text-sm text-white font-mono">{moveCount}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-300 text-xs">Game mode:</span>
                                    <span className="text-sm text-white font-mono capitalize">{gameMode.replace('_', ' ')}</span>
                                </div>
                            </CardContent>
                        </Card>
                        {renderGameOverStatus()}
                        {renderVideoCall()}
                    </div>
                </div>
            </div>
        </div>
    );
};