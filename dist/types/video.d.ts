export interface VideoCallState {
    isInCall: boolean;
    isCallActive: boolean;
    isCallInitiator: boolean;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    isMuted: boolean;
    isVideoEnabled: boolean;
    callId: string | null;
    opponentId: string | null;
}
export interface VideoCallMessage {
    type: 'video_offer' | 'video_answer' | 'ice_candidate' | 'video_call_request' | 'video_call_accepted' | 'video_call_rejected' | 'video_call_ended';
    payload: any;
    from: string;
    to: string;
    callId?: string;
}
export interface VideoCallConfig {
    iceServers: RTCIceServer[];
}
export declare const DEFAULT_ICE_SERVERS: RTCIceServer[];
//# sourceMappingURL=video.d.ts.map