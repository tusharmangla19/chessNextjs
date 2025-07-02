import { Button } from "../Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Copy } from "lucide-react";

interface WaitingScreenProps {
    createdRoomId?: string;
    onCopyRoomCode: () => void;
    onCancel: () => void;
}

export const WaitingScreen = ({
    createdRoomId,
    onCopyRoomCode,
    onCancel
}: WaitingScreenProps) => {
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
                                    <Button onClick={onCopyRoomCode} variant="ghost" size="sm" className="text-white hover:bg-white/10">
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                                <p className="text-gray-400 text-xs mt-2">Share this code with your friend</p>
                            </CardContent>
                        </Card>
                    )}
                    
                    <Button onClick={onCancel} variant="outline" className="border-white/20 text-white hover:bg-white/10">
                        Cancel
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}; 