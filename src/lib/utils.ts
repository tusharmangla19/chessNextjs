import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import ws from "ws"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Safe WebSocket send utility for ws.WebSocket
export function safeSend(socket: ws, message: any): boolean {
    if (socket.readyState === ws.OPEN) {
        try {
            socket.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error('Failed to send message:', error);
            return false;
        }
    }
    return false;
} 