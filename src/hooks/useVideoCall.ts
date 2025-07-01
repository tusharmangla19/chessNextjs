import { useState, useRef, useCallback } from 'react';
import { VideoCallState, VideoCallMessage, DEFAULT_ICE_SERVERS } from '@/types/video';

// Import SimplePeer using dynamic import to avoid bundling issues
let SimplePeer: any = null;

// Load SimplePeer dynamically
const loadSimplePeer = async () => {
  if (!SimplePeer) {
    try {
      const module = await import('simple-peer-light');
      SimplePeer = module.default || module;
    } catch (error) {
      console.error('Failed to load SimplePeer:', error);
    }
  }
  return SimplePeer;
};

export const useVideoCall = (socket: WebSocket | null, userId: string, setErrorMessage?: (msg: string) => void) => {
  const [videoCallState, setVideoCallState] = useState<VideoCallState>({
    isInCall: false,
    isCallActive: false,
    isCallInitiator: false,
    localStream: null,
    remoteStream: null,
    isMuted: false,
    isVideoEnabled: true,
    callId: null,
    opponentId: null
  });

  const peerRef = useRef<any | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Initialize local media stream
  const initializeLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setVideoCallState(prev => ({ ...prev, localStream: stream }));
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      if (setErrorMessage) setErrorMessage('Could not access camera or microphone.');
      throw error;
    }
  }, [setErrorMessage]);

  // Create peer connection
  const createPeer = useCallback(async (initiator: boolean, stream: MediaStream, callId: string, opponentId: string) => {
    const SimplePeerClass = await loadSimplePeer();
    if (!SimplePeerClass) {
      throw new Error('SimplePeer library is not loaded');
    }

    const peer = new SimplePeerClass({
      initiator,
      stream,
      trickle: false,
      config: { iceServers: DEFAULT_ICE_SERVERS }
    });

    peer.on('signal', (data: any) => {
      if (socket && callId && opponentId) {
        const message: VideoCallMessage = {
          type: initiator ? 'video_offer' : 'video_answer',
          payload: data,
          from: userId,
          to: opponentId,
          callId: callId
        };
        socket.send(JSON.stringify(message));
      }
    });

    peer.on('stream', (remoteStream: MediaStream) => {
      setVideoCallState(prev => ({ ...prev, remoteStream }));
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    });

    peer.on('connect', () => {
      setVideoCallState(prev => ({ ...prev, isCallActive: true }));
    });

    peer.on('close', () => {
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      setVideoCallState(prev => ({
        ...prev,
        isInCall: false,
        isCallActive: false
      }));
    });

    peer.on('error', (error: Error) => {
      console.error('Peer connection error:', error);
      if (setErrorMessage) setErrorMessage('Video call connection failed.');
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      setVideoCallState(prev => ({
        ...prev,
        isInCall: false,
        isCallActive: false
      }));
    });

    peerRef.current = peer;
    return peer;
  }, [socket, userId, setErrorMessage]);

  // Start a video call
  const startCall = useCallback(async (opponentId: string) => {
    try {
      const stream = await initializeLocalStream();
      const callId = Math.random().toString(36).substring(7);
      
      setVideoCallState(prev => ({
        ...prev,
        isInCall: true,
        isCallInitiator: true,
        callId,
        opponentId
      }));

      await createPeer(true, stream, callId, opponentId);

      if (socket) {
        const message: VideoCallMessage = {
          type: 'video_call_request',
          payload: { callId },
          from: userId,
          to: opponentId
        };
        socket.send(JSON.stringify(message));
      }

      // Timeout after 30 seconds
      setTimeout(() => {
        setVideoCallState(prev => {
          if (!prev.isCallActive) {
            if (peerRef.current) {
              peerRef.current.destroy();
              peerRef.current = null;
            }
            return {
              ...prev,
              isInCall: false,
              isCallActive: false,
              localStream: null,
              remoteStream: null
            };
          }
          return prev;
        });
      }, 30000);

    } catch (error) {
      console.error('Error starting call:', error);
      if (setErrorMessage) setErrorMessage('Failed to start video call.');
    }
  }, [initializeLocalStream, createPeer, socket, userId, setErrorMessage]);

  // Accept incoming call
  const acceptCall = useCallback(async (callId: string, initiatorId: string) => {
    try {
      setVideoCallState(prev => ({
        ...prev,
        isInCall: true,
        isCallInitiator: false,
        callId,
        opponentId: initiatorId
      }));

      if (socket) {
        const message: VideoCallMessage = {
          type: 'video_call_accepted',
          payload: { callId },
          from: userId,
          to: initiatorId
        };
        socket.send(JSON.stringify(message));
      }
    } catch (error) {
      console.error('Error accepting call:', error);
      if (setErrorMessage) setErrorMessage('Failed to accept video call.');
      if (socket) {
        const message: VideoCallMessage = {
          type: 'video_call_rejected',
          payload: { callId },
          from: userId,
          to: initiatorId
        };
        socket.send(JSON.stringify(message));
      }
    }
  }, [socket, userId, setErrorMessage]);

  // Reject incoming call
  const rejectCall = useCallback((callId: string, initiatorId: string) => {
    if (socket) {
      const message: VideoCallMessage = {
        type: 'video_call_rejected',
        payload: { callId },
        from: userId,
        to: initiatorId
      };
      socket.send(JSON.stringify(message));
    }
  }, [socket, userId]);

  // End current call
  const endCall = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    if (videoCallState.localStream) {
      videoCallState.localStream.getTracks().forEach(track => track.stop());
    }

    if (videoCallState.remoteStream) {
      videoCallState.remoteStream.getTracks().forEach(track => track.stop());
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setVideoCallState({
      isInCall: false,
      isCallActive: false,
      isCallInitiator: false,
      localStream: null,
      remoteStream: null,
      isMuted: false,
      isVideoEnabled: true,
      callId: null,
      opponentId: null
    });

    // Notify opponent that call ended
    if (socket && videoCallState.callId && videoCallState.opponentId) {
      const message: VideoCallMessage = {
        type: 'video_call_ended',
        payload: { callId: videoCallState.callId },
        from: userId,
        to: videoCallState.opponentId
      };
      socket.send(JSON.stringify(message));
    }
  }, [socket, userId, videoCallState.callId, videoCallState.opponentId]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (videoCallState.localStream) {
      const audioTracks = videoCallState.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setVideoCallState(prev => ({ ...prev, isMuted: !prev.isMuted }));
    }
  }, [videoCallState.localStream]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (videoCallState.localStream) {
      const videoTracks = videoCallState.localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setVideoCallState(prev => ({ ...prev, isVideoEnabled: !prev.isVideoEnabled }));
    }
  }, [videoCallState.localStream]);

  // Handle incoming video call messages
  const handleVideoMessage = useCallback((message: VideoCallMessage) => {
    switch (message.type) {
      case 'video_call_accepted':
        if (videoCallState.isCallInitiator && videoCallState.callId) {
          initializeLocalStream().then(stream => {
            createPeer(true, stream, videoCallState.callId!, message.from);
          }).catch(error => {
            console.error('Error creating peer after call accepted:', error);
          });
        }
        break;
      case 'video_call_rejected':
        if (peerRef.current) {
          peerRef.current.destroy();
          peerRef.current = null;
        }
        setVideoCallState(prev => ({
          ...prev,
          isInCall: false,
          isCallActive: false,
          localStream: null,
          remoteStream: null
        }));
        break;
      case 'video_call_ended':
        if (peerRef.current) {
          peerRef.current.destroy();
          peerRef.current = null;
        }
        setVideoCallState(prev => ({
          ...prev,
          isInCall: false,
          isCallActive: false,
          localStream: null,
          remoteStream: null
        }));
        break;
      case 'video_offer':
        if (!videoCallState.isCallInitiator && videoCallState.callId) {
          initializeLocalStream().then(stream => {
            createPeer(false, stream, videoCallState.callId!, message.from).then(peer => {
              peer.signal(message.payload);
            });
          }).catch(error => {
            console.error('Error creating peer for video offer:', error);
          });
        } else if (peerRef.current) {
          peerRef.current.signal(message.payload);
        }
        break;
      case 'video_answer':
      case 'ice_candidate':
        if (peerRef.current) {
          peerRef.current.signal(message.payload);
        }
        break;
    }
  }, [videoCallState.isCallInitiator, videoCallState.callId, initializeLocalStream, createPeer]);

  return {
    videoCallState,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    handleVideoMessage,
    localVideoRef,
    remoteVideoRef
  };
}; 