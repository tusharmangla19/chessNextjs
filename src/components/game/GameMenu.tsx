import { Button } from "../Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Bot, Users, Home } from "lucide-react";
import { GameMode } from "./types";

interface GameMenuProps {
    roomId: string;
    onRoomIdChange: (id: string) => void;
    onStartSinglePlayer: () => void;
    onStartMultiplayer: () => void;
    onCreateRoom: () => void;
    onJoinRoom: () => void;
    showTemporaryError: (message: string) => void;
}

export const GameMenu = ({
    roomId,
    onRoomIdChange,
    onStartSinglePlayer,
    onStartMultiplayer,
    onCreateRoom,
    onJoinRoom,
    showTemporaryError
}: GameMenuProps) => {
    const handleJoinRoom = () => {
        if (!roomId.trim()) return;
        
        const cleanRoomId = roomId.trim().toUpperCase();
        if (!/^[A-Z0-9]{6}$/.test(cleanRoomId)) {
            showTemporaryError("Room code must be 6 characters (letters and numbers)");
            return;
        }
        
        onJoinRoom();
    };

    return (
        <div className="h-screen flex justify-center items-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            <Card className="w-96 bg-white/10 backdrop-blur-lg border-white/20">
                <CardHeader>
                    <CardTitle className="text-center text-white text-3xl">♔ ChessMaster ♔</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={onStartSinglePlayer} variant="gradient" size="xl" className="w-full">
                        <Bot className="mr-2 h-5 w-5" />
                        Play vs AI
                    </Button>
                    
                    <Button onClick={onStartMultiplayer} variant="outline" size="xl" className="w-full border-white/20 text-white hover:bg-white/10">
                        <Users className="mr-2 h-5 w-5" />
                        Find Opponent
                    </Button>
                    
                    <Button onClick={onCreateRoom} variant="outline" size="xl" className="w-full border-white/20 text-white hover:bg-white/10">
                        <Home className="mr-2 h-5 w-5" />
                        Create Room
                    </Button>
                    
                    <div className="flex space-x-2">
                        <input
                            type="text"
                            placeholder="Enter Room Code"
                            value={roomId}
                            onChange={(e) => onRoomIdChange(e.target.value)}
                            className="flex-1 px-3 py-2 bg-white/10 text-white rounded border border-white/20 focus:outline-none focus:border-purple-500 placeholder-gray-400"
                            maxLength={6}
                        />
                        <Button onClick={handleJoinRoom} disabled={!roomId.trim()} variant="success" size="default">
                            Join
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}; 