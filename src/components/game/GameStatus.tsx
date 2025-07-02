import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { GameMode, PlayerColor } from "./types";

interface GameStatusProps {
    isPlayerTurn: boolean;
    gameMode: GameMode;
    playerColor: PlayerColor;
    moveCount: number;
    opponentDisconnected: boolean;
    disconnectTimer: number;
}

export const GameStatus = ({
    isPlayerTurn,
    gameMode,
    playerColor,
    moveCount,
    opponentDisconnected,
    disconnectTimer
}: GameStatusProps) => {
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

    return (
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
    );
}; 