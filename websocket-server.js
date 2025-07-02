const { WebSocketServer } = require('ws');
const { createGameState, addUser, removeUser, setupMessageHandler, resumeActiveGameForUser, cleanupAllTimeouts } = require('./dist/lib/state-manager');
const { prisma } = require('./dist/lib/prisma');

const wss = new WebSocketServer({ port: 8081 });
const state = createGameState();

wss.on('connection', (ws) => {
    let authenticated = false;

    ws.on('message', async (data) => {
        try {
            const msg = JSON.parse(data);
            if (!authenticated && msg.type === 'auth' && msg.clerkId) {
                // Upsert user in DB
                const user = await prisma.user.upsert({
                    where: { clerkId: msg.clerkId },
                    update: {},
                    create: { clerkId: msg.clerkId }
                });
                ws.clerkId = msg.clerkId;
                ws.userId = user.id;
                authenticated = true;
                addUser(state, ws);
                setupMessageHandler(state, ws);
                // Resume any active game for this user
                await resumeActiveGameForUser(state, ws);
                return;
            }
            if (!authenticated) {
                // Ignore all other messages until authenticated
                return;
            }
            // If authenticated, let the message handler handle the rest
        } catch (err) {
            console.error('WebSocket message error:', err);
        }
    });
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    cleanupAllTimeouts();
    
    // Close all WebSocket connections first
    wss.clients.forEach(client => {
        client.close();
    });
    
    // Close the server with a timeout
    wss.close(() => {
        console.log('✅ WebSocket server closed');
        process.exit(0);
    });
    
    // Force exit after 5 seconds if graceful shutdown fails
    setTimeout(() => {
        console.log('⚠️ Force exiting after timeout');
        process.exit(1);
    }, 5000);
});

process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    cleanupAllTimeouts();
    
    // Close all WebSocket connections first
    wss.clients.forEach(client => {
        client.close();
    });
    
    // Close the server with a timeout
    wss.close(() => {
        console.log('✅ WebSocket server closed');
        process.exit(0);
    });
    
    // Force exit after 5 seconds if graceful shutdown fails
    setTimeout(() => {
        console.log('⚠️ Force exiting after timeout');
        process.exit(1);
    }, 5000);
});

console.log('✅ WebSocket server started on port 8081'); 