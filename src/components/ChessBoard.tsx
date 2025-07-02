import { Chess, Square } from "chess.js";
import { useState, useMemo, useEffect } from "react";

const MOVE = "move";
const PROMOTION_PIECES = [
    { type: 'q', label: 'Queen', icon: '/Q copy.png' },
    { type: 'r', label: 'Rook', icon: '/R copy.png' },
    { type: 'b', label: 'Bishop', icon: '/B copy.png' },
    { type: 'n', label: 'Knight', icon: '/N copy.png' },
];

interface ChessBoardProps {
    chess: Chess;
    socket: WebSocket;
    playerColor: 'white' | 'black' | null;
    moveCount: number;
    isVideoCallActive?: boolean;
    disableMoves?: boolean;
    setErrorMessage?: (msg: string) => void;
}

export const ChessBoard: React.FC<ChessBoardProps> = ({ chess, socket, moveCount, isVideoCallActive = false, disableMoves = false, setErrorMessage, playerColor }) => {
    const [from, setFrom] = useState<null | Square>(null);
    const [pendingPromotion, setPendingPromotion] = useState<null | { from: Square, to: Square }>(null);

    // Listen for error messages from the server
    // Only attach once per socket instance
    useEffect(() => {
        if (!socket || !setErrorMessage) return;
        const handler = (event: MessageEvent) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'error' && message.payload?.message) {
                    setErrorMessage(message.payload.message);
                    setTimeout(() => setErrorMessage(''), 4000);
                }
            } catch {}
        };
        socket.addEventListener('message', handler);
        return () => socket.removeEventListener('message', handler);
    }, [socket, setErrorMessage]);

    // Calculate valid moves for UI display only (not for validation)
    const validMoves = useMemo(() => {
        if (!from) return [];
        try {
            return chess.moves({ square: from, verbose: true });
        } catch (error) {
            console.error("Error calculating moves for UI:", error);
            return [];
        }
    }, [from, chess, moveCount]);

    // Get the last move made
    const lastMove = useMemo(() => {
        const history = chess.history({ verbose: true });
        return history.length > 0 ? history[history.length - 1] : null;
    }, [chess, moveCount]);

    const getSquareClass = (squareRepresentation: Square, i: number, j: number) => {
        const squareSize = isVideoCallActive ? 'w-12 h-12 sm:w-16 sm:h-16' : 'w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20';
        let baseClass = `${squareSize} ${(i+j)%2 === 0 ? 'bg-amber-100' : 'bg-amber-800'} transition-all duration-200 hover:opacity-80`;
        
        // Highlight selected piece with a bright yellow ring
        if (from === squareRepresentation) {
            baseClass += ' ring-4 ring-yellow-400 ring-opacity-90 shadow-lg scale-105';
        }
        
        // Highlight last move with blue ring
        if (lastMove && (lastMove.from === squareRepresentation || lastMove.to === squareRepresentation)) {
            baseClass += ' ring-2 ring-blue-400 ring-opacity-50';
        }
        
        // Highlight valid moves
        const validMove = validMoves.find(move => move.to === squareRepresentation);
        if (validMove) {
            const targetPiece = chess.get(squareRepresentation);
            if (targetPiece) {
                // Capturable piece - red background
                baseClass += ' bg-red-400 bg-opacity-60';
            } else {
                // Empty square - just add relative positioning for the indicator
                baseClass += ' relative';
            }
        }
        
        return baseClass;
    };

    const handleSquareClick = (squareRepresentation: Square) => {
        if (disableMoves) return;
        if (pendingPromotion) return; // Block input while promotion is pending
        
        // Check if it's the player's turn
        const currentTurn = chess.turn() === 'w' ? 'white' : 'black';
        if (playerColor && playerColor !== currentTurn) {
            if (setErrorMessage) {
                setErrorMessage('Not your turn');
                setTimeout(() => setErrorMessage(''), 2000);
            }
            return;
        }

        // Get the piece on the clicked square
        const clickedPiece = chess.get(squareRepresentation);
        const isPlayerPiece = clickedPiece && 
            ((playerColor === 'white' && clickedPiece.color === 'w') || 
             (playerColor === 'black' && clickedPiece.color === 'b'));

        if (!from) {
            // No piece selected yet - select this piece if it's the player's
            if (isPlayerPiece) {
            setFrom(squareRepresentation);
            }
        } else {
            // A piece is already selected
            if (isPlayerPiece) {
                // Clicked on another of player's pieces - select the new piece instead
                setFrom(squareRepresentation);
                return;
            }

            // Check if this is a pawn promotion move
            const piece = chess.get(from);
            const isPawn = piece?.type === 'p';
            const isLastRank = (piece?.color === 'w' && squareRepresentation[1] === '8') || (piece?.color === 'b' && squareRepresentation[1] === '1');
            if (isPawn && isLastRank) {
                setPendingPromotion({ from, to: squareRepresentation });
                return;
            }

            // Make the move
            socket.send(JSON.stringify({
                type: MOVE,
                payload: {
                    move: { from, to: squareRepresentation }
                }
            }));
            setFrom(null);
            console.log("Move sent to server:", { from, to: squareRepresentation });
        }
    };

    const handlePromotion = (promotion: string) => {
        if (!pendingPromotion) return;
        socket.send(JSON.stringify({
            type: MOVE,
            payload: {
                move: { from: pendingPromotion.from, to: pendingPromotion.to, promotion }
            }
        }));
        setPendingPromotion(null);
        setFrom(null);
        console.log("Promotion move sent to server:", { from: pendingPromotion.from, to: pendingPromotion.to, promotion });
    };

    return (
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 shadow-2xl relative">
            {/* Promotion Modal */}
            {pendingPromotion && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
                    <div className="bg-white rounded-lg p-4 sm:p-6 flex flex-col items-center space-y-2 sm:space-y-4 shadow-2xl mx-4">
                        <div className="text-base sm:text-lg font-semibold mb-2">Choose Promotion</div>
                        <div className="flex space-x-2 sm:space-x-4">
                            {PROMOTION_PIECES.map(piece => (
                                <button
                                    key={piece.type}
                                    onClick={() => handlePromotion(piece.type)}
                                    className="flex flex-col items-center p-1 sm:p-2 hover:bg-gray-200 rounded-lg focus:outline-none"
                                >
                                    <img src={piece.icon} alt={piece.label} className="w-8 h-8 sm:w-12 sm:h-12 mb-1" />
                                    <span className="text-xs font-medium hidden sm:block">{piece.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {chess.board().map((row, i) => {
                return <div key={i} className="flex">
                    {row.map((square, j) => {
                        const squareRepresentation = String.fromCharCode(97 + (j % 8)) + "" + (8 - i) as Square;
                        const squareClass = getSquareClass(squareRepresentation, i, j);
                        const validMove = validMoves.find(move => move.to === squareRepresentation);
                        const targetPiece = chess.get(squareRepresentation);

                        return (
                            <div 
                                onClick={() => handleSquareClick(squareRepresentation)} 
                                key={j} 
                                className={`${squareClass} cursor-pointer flex items-center justify-center relative`}
                            >
                                {square ? (
                                    <img 
                                        className={`${isVideoCallActive ? 'w-8 h-8 sm:w-12 sm:h-12' : 'w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16'} object-contain drop-shadow-lg`}
                                        src={`/${square?.color === "b" ? square?.type : `${square?.type?.toUpperCase()} copy`}.png`} 
                                        alt={`${square.color} ${square.type}`}
                                    />
                                ) : null}
                                
                                {/* Valid move indicator for empty squares */}
                                {validMove && !targetPiece && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-600 rounded-full opacity-70 shadow-lg"></div>
                                    </div>
                                )}
                                
                                {/* Capturable piece indicator */}
                                {validMove && targetPiece && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-3 h-3 sm:w-4 sm:h-4 bg-red-600 rounded-full opacity-70 shadow-lg"></div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            })}
        </div>
    );
} 