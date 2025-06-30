import { NextRequest } from 'next/server';
import { WebSocketServer } from 'ws';
import { createGameState, addUser, removeUser, setupMessageHandler } from '@/lib/game-manager';

// Global state to persist across requests
let wss: WebSocketServer | null = null;
let gameState: ReturnType<typeof createGameState> | null = null;

// Initialize WebSocket server if not already done
function initializeWebSocketServer() {
    if (!wss) {
        wss = new WebSocketServer({ port: 8081 });
        gameState = createGameState();

        wss.on('connection', (ws) => {
            addUser(gameState!, ws);
            setupMessageHandler(gameState!, ws);
            
            ws.on('close', () => {
                removeUser(gameState!, ws);
            });
        });

        console.log('✅ WebSocket server started on port 8081');
    }
}

export async function GET(request: NextRequest) {
    // Initialize WebSocket server
    initializeWebSocketServer();
    
    return new Response('WebSocket server is running on port 8081', {
        status: 200,
        headers: {
            'Content-Type': 'text/plain',
        },
    });
}

// Handle WebSocket upgrade
export async function POST(request: NextRequest) {
    // Initialize WebSocket server
    initializeWebSocketServer();
    
    return new Response('WebSocket server is running on port 8081', {
        status: 200,
        headers: {
            'Content-Type': 'text/plain',
        },
    });
} 