import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { GameMode, PlayerColor } from "./types";

interface GameInfoProps {
    playerColor: PlayerColor;
    moveCount: number;
    gameMode: GameMode;
}

export const GameInfo = ({
    playerColor,
    moveCount,
    gameMode
}: GameInfoProps) => {
    return (
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
    );
}; 