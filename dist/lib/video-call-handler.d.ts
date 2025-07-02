import type { GameState, ServerWebSocket, VideoCallMessage, VideoCall } from '../types/game';
export declare function handleVideoCallMessage(state: GameState & {
    videoCalls: Map<string, VideoCall>;
}, socket: ServerWebSocket, message: VideoCallMessage): void;
//# sourceMappingURL=video-call-handler.d.ts.map