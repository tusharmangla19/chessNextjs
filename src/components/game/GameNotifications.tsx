import { Button } from "../Button";
import { Card, CardContent } from "../ui/card";

interface GameNotificationsProps {
    errorMessage: string | null;
    incomingCall: { callId: string; from: string } | null;
    onAcceptCall: () => void;
    onRejectCall: () => void;
}

export const GameNotifications = ({
    errorMessage,
    incomingCall,
    onAcceptCall,
    onRejectCall
}: GameNotificationsProps) => {
    return (
        <>
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
                                <Button onClick={onAcceptCall} variant="success" size="sm">
                                    Accept
                                </Button>
                                <Button onClick={onRejectCall} variant="danger" size="sm">
                                    Decline
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </>
    );
}; 