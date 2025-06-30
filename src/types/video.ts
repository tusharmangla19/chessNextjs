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

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' }
]; 