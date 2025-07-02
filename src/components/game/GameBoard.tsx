import { Chess } from 'chess.js';
import { ChessBoard } from "../ChessBoard";
import { VideoCallButton } from "../VideoCallButton";
import { GameStatus } from "./GameStatus";
import { GameInfo } from "./GameInfo";
import { GameOverStatus } from "./GameOverStatus";
import { VideoCallDisplay } from "./VideoCallDisplay";
import { GameMode, PlayerColor } from "./types";
import { Button } from "../ui/button";

interface GameBoardProps {
    chess: Chess;
    socket: WebSocket | null;
    playerColor: PlayerColor;
    moveCount: number;
    gameMode: GameMode;
    started: boolean;
    waitingForOpponent: boolean;
    opponentConnected: boolean;
    opponentDisconnected: boolean;
    disconnectTimer: number;
    isGameDisabled: boolean;
    videoCallState: {
        isInCall: boolean;
        isCallActive: boolean;
        isMuted: boolean;
        isVideoEnabled: boolean;
        remoteStream: MediaStream | null;
    };
    localVideoRef: React.RefObject<HTMLVideoElement>;
    remoteVideoRef: React.RefObject<HTMLVideoElement>;
    onStartVideoCall: () => void;
    onToggleMute: () => void;
    onToggleVideo: () => void;
    onEndCall: () => void;
    onLeaveGame: () => void;
    setErrorMessage: (message: string | null) => void;
}

export const GameBoard = ({
    chess,
    socket,
    playerColor,
    moveCount,
    gameMode,
    started,
    waitingForOpponent,
    opponentConnected,
    opponentDisconnected,
    disconnectTimer,
    isGameDisabled,
    videoCallState,
    localVideoRef,
    remoteVideoRef,
    onStartVideoCall,
    onToggleMute,
    onToggleVideo,
    onEndCall,
    onLeaveGame,
    setErrorMessage
}: GameBoardProps) => {
    const currentTurn = chess.turn() === 'w' ? 'white' : 'black';
    const isPlayerTurn = playerColor === currentTurn;

    return (
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
                            {socket && (
                                <ChessBoard 
                                    chess={chess} 
                                    socket={socket} 
                                    playerColor={playerColor}
                                    moveCount={moveCount}
                                    isVideoCallActive={videoCallState.isInCall}
                                    disableMoves={isGameDisabled}
                                    setErrorMessage={setErrorMessage}
                                />
                            )}
                        </div>
                        
                        {started && gameMode !== 'single_player' && !videoCallState.isInCall && (
                            <div className="mt-4">
                                <VideoCallButton
                                    onClick={onStartVideoCall}
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
                    <GameStatus
                        isPlayerTurn={isPlayerTurn}
                        gameMode={gameMode}
                        playerColor={playerColor}
                        moveCount={moveCount}
                        opponentDisconnected={opponentDisconnected}
                        disconnectTimer={disconnectTimer}
                    />
                    
                    <GameInfo
                        playerColor={playerColor}
                        moveCount={moveCount}
                        gameMode={gameMode}
                    />
                    <Button
                        variant="danger"
                        className="w-full mt-1"
                        onClick={onLeaveGame}
                    >
                        Leave Game
                    </Button>
                    <GameOverStatus
                        chess={chess}
                        currentTurn={currentTurn}
                    />
                    
                    <VideoCallDisplay
                        isInCall={videoCallState.isInCall}
                        isCallActive={videoCallState.isCallActive}
                        isMuted={videoCallState.isMuted}
                        isVideoEnabled={videoCallState.isVideoEnabled}
                        remoteStream={videoCallState.remoteStream}
                        localVideoRef={localVideoRef}
                        remoteVideoRef={remoteVideoRef}
                        onToggleMute={onToggleMute}
                        onToggleVideo={onToggleVideo}
                        onEndCall={onEndCall}
                    />
                </div>
            </div>
            
            {/* Mobile Layout */}
            <div className="flex md:hidden flex-col flex-1 gap-2">
                <div className="flex-1 flex flex-col items-center">
                    <div className={`bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 ${videoCallState.isInCall ? 'p-2' : 'p-3'}`}> 
                        {socket && (
                            <ChessBoard
                                chess={chess}
                                socket={socket}
                                playerColor={playerColor}
                                moveCount={moveCount}
                                isVideoCallActive={videoCallState.isInCall}
                                disableMoves={isGameDisabled}
                                setErrorMessage={setErrorMessage}
                            />
                        )}
                    </div>
                    {started && gameMode !== 'single_player' && !videoCallState.isInCall && (
                        <div className="mt-2 w-full flex justify-center">
                            <VideoCallButton
                                onClick={onStartVideoCall}
                                disabled={!started}
                                isInCall={false}
                                className="w-full"
                            />
                        </div>
                    )}
                </div>
                <div className="space-y-2 mt-2">
                    <GameStatus
                        isPlayerTurn={isPlayerTurn}
                        gameMode={gameMode}
                        playerColor={playerColor}
                        moveCount={moveCount}
                        opponentDisconnected={opponentDisconnected}
                        disconnectTimer={disconnectTimer}
                    />
                    <GameInfo
                        playerColor={playerColor}
                        moveCount={moveCount}
                        gameMode={gameMode}
                    />
                    <Button
                        variant="danger"
                        className="w-full mt-1"
                        onClick={onLeaveGame}
                    >
                        Leave Game
                    </Button>
                    <GameOverStatus
                        chess={chess}
                        currentTurn={currentTurn}
                    />
                    <VideoCallDisplay
                        isInCall={videoCallState.isInCall}
                        isCallActive={videoCallState.isCallActive}
                        isMuted={videoCallState.isMuted}
                        isVideoEnabled={videoCallState.isVideoEnabled}
                        remoteStream={videoCallState.remoteStream}
                        localVideoRef={localVideoRef}
                        remoteVideoRef={remoteVideoRef}
                        onToggleMute={onToggleMute}
                        onToggleVideo={onToggleVideo}
                        onEndCall={onEndCall}
                    />
                </div>
            </div>
        </div>
    );
}; 