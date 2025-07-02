import type { GameState, ServerWebSocket, VideoCallMessage, VideoCall } from '../types/game';
import { safeSend } from './utils';
import { VIDEO_CALL_REQUEST, VIDEO_CALL_ACCEPTED, VIDEO_CALL_REJECTED, VIDEO_CALL_ENDED, VIDEO_OFFER, VIDEO_ANSWER, ICE_CANDIDATE, ERROR } from '../types/game';

export function handleVideoCallMessage(state: GameState & { videoCalls: Map<string, VideoCall> }, socket: ServerWebSocket, message: VideoCallMessage): void {
    switch (message.type) {
        case VIDEO_CALL_REQUEST:
            handleVideoCallRequest(state, socket, message);
            break;
        case VIDEO_CALL_ACCEPTED:
            handleVideoCallAccepted(state, socket, message);
            break;
        case VIDEO_CALL_REJECTED:
            handleVideoCallRejected(state, socket, message);
            break;
        case VIDEO_CALL_ENDED:
            handleVideoCallEnded(state, socket, message);
            break;
        case VIDEO_OFFER:
        case VIDEO_ANSWER:
        case ICE_CANDIDATE:
            handleVideoSignaling(state, socket, message);
            break;
    }
}

function handleVideoCallRequest(state: GameState & { videoCalls: Map<string, VideoCall> }, socket: ServerWebSocket, message: VideoCallMessage): void {
    const { payload } = message;
    const callId = payload?.callId;
    if (!callId) return;
    const targetUser = findOpponent(state, socket);
    if (!targetUser) {
        socket.send(JSON.stringify({
            type: ERROR,
            payload: { message: "No opponent available for video call" }
        }));
        return;
    }
    const videoCall: VideoCall = {
        id: callId,
        initiator: socket,
        status: 'pending',
        startTime: new Date()
    };
    state.videoCalls.set(callId, videoCall);
    targetUser.send(JSON.stringify({
        type: VIDEO_CALL_REQUEST,
        payload: { callId },
        from: 'opponent',
        to: 'you'
    }));
}

function findOpponent(state: GameState, socket: ServerWebSocket): ServerWebSocket | null {
    const game = state.games.find(game => game.player1 === socket || game.player2 === socket);
    if (game) {
        return game.player1 === socket ? game.player2 : game.player1;
    }
    for (const room of Array.from(state.rooms.values())) {
        if (room.player1 === socket && room.player2) return room.player2;
        if (room.player2 === socket && room.player1) return room.player1;
    }
    return null;
}

function handleVideoCallAccepted(state: GameState & { videoCalls: Map<string, VideoCall> }, socket: ServerWebSocket, message: VideoCallMessage): void {
    const { payload } = message;
    const callId = payload?.callId;
    if (!callId) return;
    const videoCall = state.videoCalls.get(callId);
    if (videoCall && videoCall.initiator !== socket) {
        videoCall.receiver = socket;
        videoCall.status = 'active';
        videoCall.initiator.send(JSON.stringify({
            type: VIDEO_CALL_ACCEPTED,
            payload: { callId },
            from: 'opponent',
            to: 'you'
        }));
    }
}

function handleVideoCallRejected(state: GameState & { videoCalls: Map<string, VideoCall> }, socket: ServerWebSocket, message: VideoCallMessage): void {
    const { payload } = message;
    const callId = payload?.callId;
    if (!callId) return;
    const videoCall = state.videoCalls.get(callId);
    if (videoCall) {
        videoCall.initiator.send(JSON.stringify({
            type: VIDEO_CALL_REJECTED,
            payload: { callId },
            from: 'opponent',
            to: 'you'
        }));
        state.videoCalls.delete(callId);
    }
}

function handleVideoCallEnded(state: GameState & { videoCalls: Map<string, VideoCall> }, socket: ServerWebSocket, message: VideoCallMessage): void {
    const { payload } = message;
    const callId = payload?.callId;
    if (!callId) return;
    const videoCall = state.videoCalls.get(callId);
    if (videoCall) {
        const otherParticipant = videoCall.initiator === socket ? videoCall.receiver : videoCall.initiator;
        if (otherParticipant) {
            otherParticipant.send(JSON.stringify({
                type: VIDEO_CALL_ENDED,
                payload: { callId },
                from: 'opponent',
                to: 'you'
            }));
        }
        state.videoCalls.delete(callId);
    }
}

function handleVideoSignaling(state: GameState & { videoCalls: Map<string, VideoCall> }, socket: ServerWebSocket, message: VideoCallMessage): void {
    const { callId } = message;
    if (!callId) return;
    const videoCall = state.videoCalls.get(callId);
    if (videoCall?.status === 'active') {
        const otherParticipant = videoCall.initiator === socket ? videoCall.receiver : videoCall.initiator;
        if (otherParticipant) {
            otherParticipant.send(JSON.stringify({
                type: message.type,
                payload: message.payload,
                from: 'opponent',
                to: 'you',
                callId
            }));
        }
    }
}

// ... move all video call handling logic here ...
// Export all these functions 