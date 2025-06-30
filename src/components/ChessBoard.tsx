import { Chess, Square } from "chess.js";
import { useState, useMemo } from "react";

const MOVE = "move";

interface ChessBoardProps {
    chess: Chess;
    socket: WebSocket;
    playerColor: 'white' | 'black' | null;
    moveCount: number;
    isVideoCallActive?: boolean;
    disableMoves?: boolean;
}

export const ChessBoard: React.FC<ChessBoardProps> = ({ chess, socket, moveCount, isVideoCallActive = false, disableMoves = false }) => {
    const [from, setFrom] = useState<null | Square>(null);

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
        const squareSize = isVideoCallActive ? 'w-16 h-16' : 'w-20 h-20';
        let baseClass = `${squareSize} ${(i+j)%2 === 0 ? 'bg-amber-100' : 'bg-amber-800'} transition-all duration-200 hover:opacity-80`;
        if (from === squareRepresentation) {
            baseClass += ' ring-4 ring-yellow-400 ring-opacity-75 shadow-lg';
        }
        if (lastMove && (lastMove.from === squareRepresentation || lastMove.to === squareRepresentation)) {
            baseClass += ' ring-2 ring-blue-400 ring-opacity-50';
        }
        const validMove = validMoves.find(move => move.to === squareRepresentation);
        if (validMove) {
            const targetPiece = chess.get(squareRepresentation);
            if (targetPiece) {
                baseClass += ' bg-red-400';
            } else {
                baseClass += ' relative';
            }
        }
        return baseClass;
    };

    const handleSquareClick = (squareRepresentation: Square) => {
        if (disableMoves) return;
        if (!from) {
            setFrom(squareRepresentation);
        } else {
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

    return (
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 shadow-2xl">
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
                                        className={`${isVideoCallActive ? 'w-12 h-12' : 'w-16 h-16'} object-contain drop-shadow-lg`}
                                        src={`/${square?.color === "b" ? square?.type : `${square?.type?.toUpperCase()} copy`}.png`} 
                                        alt={`${square.color} ${square.type}`}
                                    />
                                ) : null}
                                
                                {/* Valid move indicator for empty squares */}
                                {validMove && !targetPiece && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-4 h-4 bg-green-600 rounded-full opacity-70 shadow-lg"></div>
                                    </div>
                                )}
                                
                                {/* Capturable piece indicator */}
                                {validMove && targetPiece && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-4 h-4 bg-red-600 rounded-full opacity-70 shadow-lg"></div>
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