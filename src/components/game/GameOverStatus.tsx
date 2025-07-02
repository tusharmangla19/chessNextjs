import { Card, CardContent } from "../ui/card";
import { Chess } from 'chess.js';

interface GameOverStatusProps {
    chess: Chess;
    currentTurn: 'white' | 'black';
}

export const GameOverStatus = ({
    chess,
    currentTurn
}: GameOverStatusProps) => {
    if (chess.isCheckmate()) {
        return (
            <Card className="bg-red-600 border-red-500">
                <CardContent className="p-2 text-center">
                    <div className="text-sm font-bold text-white">Checkmate!</div>
                    <div className="text-xs text-white">{currentTurn === 'white' ? 'Black' : 'White'} wins!</div>
                </CardContent>
            </Card>
        );
    }

    if (chess.isDraw() && !chess.isCheckmate()) {
        let drawReason = '';
        if (chess.isStalemate()) drawReason = 'Stalemate';
        else if (chess.isThreefoldRepetition()) drawReason = 'Threefold Repetition';
        else if (chess.isInsufficientMaterial()) drawReason = 'Insufficient Material';
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

    if (chess.isCheck()) {
        return (
            <Card className="bg-orange-600 border-orange-500">
                <CardContent className="p-2 text-center">
                    <div className="text-sm font-bold text-white">Check!</div>
                </CardContent>
            </Card>
        );
    }

    if (chess.isGameOver()) {
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