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
const INIT_GAME = "init_game";
const MOVE = "move";
const GAME_OVER = "game_over";
const ERROR = "error";
const SINGLE_PLAYER = "single_player";
const CREATE_ROOM = "create_room";
const JOIN_ROOM = "join_room";
const ROOM_CREATED = "room_created";
const ROOM_JOINED = "room_joined";
const ROOM_NOT_FOUND = "room_not_found";
const WAITING_FOR_OPPONENT = "waiting_for_opponent";

// Video call message types
const VIDEO_CALL_REQUEST = "video_call_request";
const VIDEO_CALL_ACCEPTED = "video_call_accepted";
const VIDEO_CALL_REJECTED = "video_call_rejected";
const VIDEO_CALL_ENDED = "video_call_ended";
const VIDEO_OFFER = "video_offer";
const VIDEO_ANSWER = "video_answer";
const ICE_CANDIDATE = "ice_candidate";

type GameMode = 'menu' | 'single_player' | 'multiplayer' | 'room_creator' | 'room_joiner';

export const Game = () => {
    const socket = useSocket();
    const chessRef = useRef(new Chess());
    const [gameMode, setGameMode] = useState<GameMode>('menu');
    const [roomId, setRoomId] = useState('');
    const [createdRoomId, setCreatedRoomId] = useState('');
    const [waitingForOpponent, setWaitingForOpponent] = useState(false);
    const [opponentConnected, setOpponentConnected] = useState(true);
    const [started, setStarted] = useState(false);
    const [playerColor, setPlayerColor] = useState<'white' | 'black' | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [incomingCall, setIncomingCall] = useState<{ callId: string; from: string } | null>(null);
    const [opponentId] = useState<string>('opponent');
    const [moveCount, setMoveCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [hasCheckedResume, setHasCheckedResume] = useState(false);
    const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [opponentDisconnected, setOpponentDisconnected] = useState(false);
    const [disconnectTimer, setDisconnectTimer] = useState<number>(0);
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

    useEffect(() => {
        setIsLoading(true);
        setHasCheckedResume(false);
        // Fallback: if no server response in 5s, stop loading
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = setTimeout(() => {
            setIsLoading(false);
            setHasCheckedResume(true);
        }, 5000);
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
        console.log('⏰ Timer effect triggered:', { disconnectTimer, opponentDisconnected });
        if (disconnectTimer === 0 && opponentDisconnected) {
            console.log('⏰ Timer expired, ending game');
            setOpponentDisconnected(false);
            setErrorMessage('Game ended due to opponent disconnection.');
            setTimeout(() => setErrorMessage(null), 3000);
            resetGame();
        }
    }, [disconnectTimer, opponentDisconnected]);



    useEffect(() => {
        if (!socket) return;

        socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                // Handle video call messages
                if ([VIDEO_CALL_REQUEST, VIDEO_CALL_ACCEPTED, VIDEO_CALL_REJECTED, VIDEO_CALL_ENDED, VIDEO_OFFER, VIDEO_ANSWER, ICE_CANDIDATE].includes(message.type)) {
                    handleVideoMessage(message);
                    
                    if (message.type === VIDEO_CALL_REQUEST) {
                        setIncomingCall({
                            callId: message.payload.callId,
                            from: message.from
                        });
                    }
                    
                    if (message.type === VIDEO_CALL_ACCEPTED || message.type === VIDEO_CALL_REJECTED) {
                        setIncomingCall(null);
                    }
                    
                    return;
                }

                switch (message.type) {
                    case INIT_GAME:
                        setIsLoading(false);
                        setHasCheckedResume(true);
                        setStarted(true);
                        setPlayerColor(message.payload.color);
                        setWaitingForOpponent(false);
                        break;
                    case MOVE:
                        const move = message.payload.move;
                        try {
                            // Apply move only after server validation
                            // This ensures we only show moves that the server has validated
                            chessRef.current.move(move);
                            setMoveCount(prev => prev + 1);
                            console.log("Move applied after server validation:", move);
                        } catch (error) {
                            console.error("Error applying server-validated move:", error);
                            // This shouldn't happen if server validation is working correctly
                            setErrorMessage("Error applying move from server");
                            setTimeout(() => setErrorMessage(null), 3000);
                        }
                        break;
                    case 'resume_game': {
                        console.log('📱 Frontend received resume_game message:', message.payload);
                        setIsLoading(false);
                        setHasCheckedResume(true);
                        const { color, fen, moveHistory, opponentConnected, waitingForOpponent } = message.payload;
                        const chess = new Chess();
                        if (fen) {
                            chess.load(fen);
                        } else if (moveHistory && moveHistory.length > 0) {
                            moveHistory.forEach((m: any) => {
                                chess.move({ from: m.from, to: m.to, promotion: m.san.endsWith('=Q') ? 'q' : undefined });
                            });
                        }
                        chessRef.current = chess;
                        setPlayerColor(color);
                        setStarted(true);
                        setWaitingForOpponent(!!waitingForOpponent);
                        setOpponentConnected(!!opponentConnected);
                        setMoveCount(moveHistory ? moveHistory.length : 0);
                        setGameMode('multiplayer');
                        console.log('✅ Game resumed successfully');
                        break;
                    }
                    case GAME_OVER:
                        setIsLoading(false);
                        setHasCheckedResume(true);
                        const winner = message.payload.winner;
                        const reason = message.payload.reason;
                        let gameOverMessage = '';
                        
                        if (winner) {
                            gameOverMessage = `Game Over! ${winner} wins by ${reason}!`;
                        } else {
                            gameOverMessage = `Game Over! Draw by ${reason}!`;
                        }
                        
                        setErrorMessage(gameOverMessage);
                        // Don't auto-clear game over messages
                        break;
                    case ERROR:
                        setIsLoading(false);
                        setHasCheckedResume(true);
                        setErrorMessage(message.payload.message);
                        setTimeout(() => setErrorMessage(null), 3000);
                        break;
                    case WAITING_FOR_OPPONENT:
                        setIsLoading(false);
                        setHasCheckedResume(true);
                        setWaitingForOpponent(true);
                        break;
                    case ROOM_CREATED:
                        setIsLoading(false);
                        setHasCheckedResume(true);
                        setCreatedRoomId(message.payload.roomId);
                        setWaitingForOpponent(true);
                        break;
                    case ROOM_JOINED:
                        setIsLoading(false);
                        setHasCheckedResume(true);
                        setStarted(true);
                        setPlayerColor(message.payload.color);
                        setWaitingForOpponent(false);
                        break;
                    case ROOM_NOT_FOUND:
                        setIsLoading(false);
                        setHasCheckedResume(true);
                        setErrorMessage(message.payload.message);
                        setTimeout(() => setErrorMessage(null), 3000);
                        break;
                    case 'opponent_left':
                        setIsLoading(false);
                        setHasCheckedResume(true);
                        setErrorMessage('Opponent left the match.');
                        setTimeout(() => setErrorMessage(null), 3000);
                        resetGame();
                        break;
                    case 'opponent_disconnected':
                        console.log('📱 Frontend received opponent_disconnected message');
                        setIsLoading(false);
                        setHasCheckedResume(true);
                        setOpponentDisconnected(true);
                        setDisconnectTimer(60); // 60 seconds = 1 minute
                        console.log('⏰ Timer started at 60 seconds');
                        
                        // Clear any existing timer before starting a new one
                        if (disconnectTimerRef.current) {
                            clearInterval(disconnectTimerRef.current);
                            disconnectTimerRef.current = null;
                        }
                        
                        // Start countdown timer
                        disconnectTimerRef.current = setInterval(() => {
                            setDisconnectTimer(prev => {
                                console.log('⏰ Timer tick:', prev, '->', prev - 1);
                                if (prev <= 0) {
                                    // Timer expired, game will end
                                    console.log('⏰ Timer expired!');
                                    if (disconnectTimerRef.current) {
                                        clearInterval(disconnectTimerRef.current);
                                        disconnectTimerRef.current = null;
                                    }
                                    return 0;
                                }
                                return prev - 1;
                            });
                        }, 1000);
                        break;
                    case 'opponent_reconnected':
                        console.log('📱 Frontend received opponent_reconnected message');
                        setIsLoading(false);
                        setHasCheckedResume(true);
                        setOpponentDisconnected(false);
                        setDisconnectTimer(0);
                        
                        // Clear the disconnect timer
                        if (disconnectTimerRef.current) {
                            clearInterval(disconnectTimerRef.current);
                            disconnectTimerRef.current = null;
                        }
                        break;
                    case 'game_ended_disconnect':
                        setIsLoading(false);
                        setHasCheckedResume(true);
                        setOpponentDisconnected(false);
                        setDisconnectTimer(0);
                        
                        // Clear the disconnect timer
                        if (disconnectTimerRef.current) {
                            clearInterval(disconnectTimerRef.current);
                            disconnectTimerRef.current = null;
                        }
                        
                        setErrorMessage('Game ended due to opponent disconnection.');
                        setTimeout(() => setErrorMessage(null), 3000);
                        resetGame();
                        break;
                }
            } catch (error) {
                console.error("Error parsing WebSocket message:", error);
                setErrorMessage("Error processing server message");
                setTimeout(() => setErrorMessage(null), 3000);
            }
        };
    }, [socket, handleVideoMessage]);

    const startSinglePlayer = () => {
        if (socket) {
            socket.send(JSON.stringify({ type: SINGLE_PLAYER }));
            setGameMode('single_player');
        }
    };

    const startMultiplayer = () => {
        if (socket) {
            socket.send(JSON.stringify({ type: INIT_GAME }));
            setGameMode('multiplayer');
            setWaitingForOpponent(true);
        }
    };

    const createRoom = () => {
        if (socket) {
            socket.send(JSON.stringify({ type: CREATE_ROOM }));
            setGameMode('room_creator');
        }
    };

    const joinRoom = () => {
        if (socket && roomId.trim()) {
            const cleanRoomId = roomId.trim().toUpperCase();
            if (!/^[A-Z0-9]{6}$/.test(cleanRoomId)) {
                setErrorMessage("Room code must be 6 characters (letters and numbers)");
                setTimeout(() => setErrorMessage(null), 3000);
                return;
            }
            
            socket.send(JSON.stringify({
                type: JOIN_ROOM,
                payload: { roomId: cleanRoomId }
            }));
            setGameMode('room_joiner');
        }
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
        
        // Clear disconnect timer
        if (disconnectTimerRef.current) {
            clearInterval(disconnectTimerRef.current);
            disconnectTimerRef.current = null;
        }
    };

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

    const endGame = () => {
        if (socket) {
            socket.send(JSON.stringify({ type: 'END_GAME' }));
            resetGame();
        }
    };

    if (!socket) return (
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

    const currentTurn = chessRef.current.turn() === 'w' ? 'white' : 'black';
    const isPlayerTurn = playerColor === currentTurn;
    const moveHistory = chessRef.current.history();

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

    return (
        <div className="h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-2 overflow-hidden">
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

            {incomingCall && (
                <div className="fixed top-2 left-2 z-50">
                    <Card className="bg-blue-600 border-blue-500 text-white">
                        <CardContent className="p-3">
                            <div className="flex items-center space-x-2">
                                <span>📞</span>
                                <span>Incoming call from {incomingCall.from}</span>
                                <Button
                                    onClick={handleAcceptIncomingCall}
                                    variant="success"
                                    size="sm"
                                >
                                    Accept
                                </Button>
                                <Button
                                    onClick={handleRejectIncomingCall}
                                    variant="danger"
                                    size="sm"
                                >
                                    Decline
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
            
            <div className="h-full max-w-7xl mx-auto flex flex-col">
                {/* Desktop Layout: Board and Info Side by Side */}
                <div className="hidden md:flex gap-4 flex-1">
                    <div className="flex-1 flex justify-center items-start">
                        {waitingForOpponent || !opponentConnected ? (
                            <div className="p-4 text-center text-lg font-semibold text-yellow-700 bg-yellow-100 rounded-lg mb-4">
                                Waiting for opponent to connect...
                            </div>
                        ) : null}
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
                                    disableMoves={waitingForOpponent || !opponentConnected || opponentDisconnected}
                                    setErrorMessage={setErrorMessage}
                            />
                            </div>
                            
                            {/* Video Call Button - Only show when not in call */}
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
                    
                    <div className={`space-y-2 ${videoCallState.isInCall ? 'w-60' : 'w-72'}`}>
                        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                            <CardHeader className="pb-1">
                                <CardTitle className="text-white text-center text-sm">Game Status</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="text-center">
                                    {opponentDisconnected ? (
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
                                    ) : (
                                    <Badge 
                                        variant={isPlayerTurn ? "success" : "secondary"}
                                        className="text-sm px-3 py-1"
                                    >
                                        {gameMode === 'single_player' ? 
                                            (isPlayerTurn ? 'Your Turn' : "AI's Turn") : 
                                            (isPlayerTurn ? 'Your Turn' : "Opponent's Turn")
                                        }
                                    </Badge>
                                    )}
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
                                    <span className="text-gray-300 text-xs">Current turn:</span>
                                    <div className={`text-sm font-bold ${currentTurn === 'white' ? 'text-white' : 'text-gray-300'}`}>
                                        {currentTurn === 'white' ? '⚪ White' : '⚫ Black'}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        

                        
                        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                            <CardHeader className="pb-1">
                                <CardTitle className="text-white text-xs">Move History:</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className={`overflow-y-auto text-xs space-y-1 ${
                                    videoCallState.isInCall ? 'max-h-20' : 'max-h-32'
                                }`}>
                                    {moveHistory.length === 0 ? (
                                        <div className="text-gray-500 text-center">No moves yet</div>
                                    ) : (
                                        <div className="space-y-1">
                                            {moveHistory.map((move, index) => (
                                                <div key={index} className="flex justify-between">
                                                    <span className="text-gray-400">{Math.floor(index / 2) + 1}.</span>
                                                    <span className="text-white">{move}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                        
                        {chessRef.current.isCheckmate() && (
                            <Card className="bg-red-600 border-red-500">
                                <CardContent className="p-2 text-center">
                                    <div className="text-sm font-bold text-white">Checkmate!</div>
                                    <div className="text-xs text-white">{currentTurn === 'white' ? 'Black' : 'White'} wins!</div>
                                </CardContent>
                            </Card>
                        )}
                        
                        {chessRef.current.isDraw() && !chessRef.current.isCheckmate() && (
                            <Card className="bg-yellow-600 border-yellow-500">
                                <CardContent className="p-2 text-center">
                                    <div className="text-sm font-bold text-white">Draw!</div>
                                    <div className="text-xs text-white">
                                        {chessRef.current.isStalemate() && 'Stalemate'}
                                        {chessRef.current.isThreefoldRepetition() && 'Threefold Repetition'}
                                        {chessRef.current.isInsufficientMaterial() && 'Insufficient Material'}
                                        {chessRef.current.isDraw() && !chessRef.current.isStalemate() && 
                                         !chessRef.current.isThreefoldRepetition() && !chessRef.current.isInsufficientMaterial() && 
                                         'Fifty-Move Rule'}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                        
                        {chessRef.current.isCheck() && !chessRef.current.isCheckmate() && (
                            <Card className="bg-orange-600 border-orange-500">
                                <CardContent className="p-2 text-center">
                                    <div className="text-sm font-bold text-white">Check!</div>
                                </CardContent>
                            </Card>
                        )}
                        
                        {chessRef.current.isGameOver() && (
                            <Card className="bg-gray-600 border-gray-500">
                                <CardContent className="p-2 text-center">
                                    <div className="text-sm font-bold text-white">Game Over</div>
                                    <div className="text-xs text-white">No more moves allowed</div>
                                </CardContent>
                            </Card>
                        )}
                        
                        <Button onClick={resetGame} variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">
                            New Game
                        </Button>
                        
                        {started && gameMode === 'multiplayer' && (
                            <Button onClick={endGame} variant="danger" className="w-full">
                                End Game
                            </Button>
                        )}
                    </div>
                </div>

                {/* Mobile Layout: Board on top, Info below */}
                <div className="md:hidden flex flex-col h-full">
                    {/* Chess Board - Takes most space */}
                    <div className="flex-1 flex flex-col justify-center items-center p-2">
                        {waitingForOpponent || !opponentConnected ? (
                            <div className="p-4 text-center text-lg font-semibold text-yellow-700 bg-yellow-100 rounded-lg mb-4">
                                Waiting for opponent to connect...
                            </div>
                        ) : null}
                        <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-2">
                            <ChessBoard 
                                chess={chessRef.current} 
                                socket={socket} 
                                playerColor={playerColor}
                                moveCount={moveCount}
                                isVideoCallActive={videoCallState.isInCall}
                                disableMoves={waitingForOpponent || !opponentConnected || opponentDisconnected}
                                setErrorMessage={setErrorMessage}
                            />
                        </div>
                        
                        {/* Video Call Button - Only show when not in call */}
                        {started && gameMode !== 'single_player' && !videoCallState.isInCall && (
                            <div className="mt-4">
                                <VideoCallButton
                                    onClick={handleStartVideoCall}
                                    disabled={!started}
                                    isInCall={false}
                                    className="w-full max-w-xs"
                                />
                            </div>
                        )}
                    </div>
                    
                    {/* Game Info - Compact mobile layout */}
                    <div className="flex-shrink-0 p-2">
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                                <CardContent className="p-2">
                                    <div className="text-center">
                                        {opponentDisconnected ? (
                                            <div className="space-y-1">
                                                <Badge variant="danger" className="text-xs px-2 py-1">
                                                    Opponent Disconnected
                                                </Badge>
                                                <div className="text-white text-sm font-bold">
                                                    {Math.floor(disconnectTimer / 60)}:{(disconnectTimer % 60).toString().padStart(2, '0')}
                                                </div>
                                            </div>
                                        ) : (
                                            <Badge 
                                                variant={isPlayerTurn ? "success" : "secondary"}
                                                className="text-xs px-2 py-1"
                                            >
                                                {gameMode === 'single_player' ? 
                                                    (isPlayerTurn ? 'Your Turn' : "AI's Turn") : 
                                                    (isPlayerTurn ? 'Your Turn' : "Opponent's Turn")
                                                }
                                            </Badge>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                            
                            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                                <CardContent className="p-2">
                                    <div className="text-center text-xs">
                                        <div className="text-gray-300">You are:</div>
                                        <div className={`font-bold ${playerColor === 'white' ? 'text-white' : 'text-gray-300'}`}>
                                            {playerColor === 'white' ? '⚪ White' : '⚫ Black'}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        
                        <Button onClick={resetGame} variant="outline" className="w-full border-white/20 text-white hover:bg-white/10 text-sm">
                            New Game
                        </Button>
                        
                        {started && gameMode === 'multiplayer' && (
                            <Button onClick={endGame} variant="danger" className="w-full text-sm">
                                End Game
                            </Button>
                        )}
                    </div>
                </div>

                {/* Video Call Section - Responsive */}
                {videoCallState.isInCall && (
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
                )}


            </div>
        </div>
    );
} 