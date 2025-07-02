import { Button } from "../Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react";

interface VideoCallDisplayProps {
    isInCall: boolean;
    isCallActive: boolean;
    isMuted: boolean;
    isVideoEnabled: boolean;
    remoteStream: MediaStream | null;
    localVideoRef: React.RefObject<HTMLVideoElement>;
    remoteVideoRef: React.RefObject<HTMLVideoElement>;
    onToggleMute: () => void;
    onToggleVideo: () => void;
    onEndCall: () => void;
}

export const VideoCallDisplay = ({
    isInCall,
    isCallActive,
    isMuted,
    isVideoEnabled,
    remoteStream,
    localVideoRef,
    remoteVideoRef,
    onToggleMute,
    onToggleVideo,
    onEndCall
}: VideoCallDisplayProps) => {
    if (!isInCall) return null;

    return (
        <div className="mt-2">
            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardHeader className="pb-1">
                    <CardTitle className="text-white text-center text-sm">Video Call</CardTitle>
                    {!isCallActive && (
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
                            {!remoteStream && (
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
                            {!isVideoEnabled && (
                                <div className="absolute inset-0 bg-slate-600 rounded-lg flex items-center justify-center">
                                    <span className="text-white text-xs">Camera Off</span>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex justify-center space-x-2 mt-2">
                        <Button
                            onClick={onToggleMute}
                            variant={isMuted ? "danger" : "secondary"}
                            size="icon"
                            className="h-7 w-7"
                        >
                            {isMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                        </Button>
                        
                        <Button
                            onClick={onToggleVideo}
                            variant={!isVideoEnabled ? "danger" : "secondary"}
                            size="icon"
                            className="h-7 w-7"
                        >
                            {isVideoEnabled ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
                        </Button>
                        
                        <Button
                            onClick={onEndCall}
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
    );
}; 