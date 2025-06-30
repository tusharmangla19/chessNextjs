# Chess Game with Video Call - Next.js Version

A multiplayer chess game with integrated video call functionality built with Next.js, TypeScript, and WebRTC.

## Features

### Chess Game
- Multiplayer chess gameplay
- Single player vs AI
- Room-based multiplayer with custom room codes
- Real-time move synchronization
- Game state management
- Move history tracking

### Video Call
- **WebRTC-based video calling** between players
- **Real-time audio and video** communication
- **Mute/unmute** functionality
- **Enable/disable camera** functionality
- **Call controls** (accept, reject, end call)
- **Picture-in-picture** local video display
- **Automatic connection** handling

## Technology Stack

### Frontend
- Next.js 15 with TypeScript
- React 18 with App Router
- Tailwind CSS for styling
- WebRTC with simple-peer-light library
- WebSocket for real-time communication

### Backend
- Node.js WebSocket server
- TypeScript for type safety
- Chess.js for game logic
- Video call signaling server

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd chess-nextjs
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the server**
   ```bash
   npm run build-server
   ```

### Running the Application

1. **Start the full application (WebSocket server + Next.js dev server)**
   ```bash
   npm run dev-full
   ```
   This will:
   - Build the TypeScript server code
   - Start the WebSocket server on port 8081
   - Start the Next.js development server on port 3000

2. **Or run components separately:**
```bash
   # Build and start WebSocket server only
   npm run build-server
   npm run start-server
   
   # Start Next.js development server only
npm run dev
   ```

3. **Open your browser**
   Navigate to `http://localhost:3000`

## How to Use Video Call

### Starting a Video Call
1. Start a multiplayer game (either "Find Opponent" or join/create a room)
2. Once the game starts, you'll see a "Video Call" button in the sidebar
3. Click the button to initiate a video call with your opponent
4. Grant camera and microphone permissions when prompted

### Receiving a Video Call
1. When an opponent initiates a call, you'll see an incoming call notification
2. Click "Accept" to join the call or "Decline" to reject it
3. Grant camera and microphone permissions when prompted

### During a Video Call
- **Mute/Unmute**: Click the microphone button to toggle audio
- **Enable/Disable Camera**: Click the camera button to toggle video
- **End Call**: Click the phone button to end the call
- **Local Video**: Your video appears in a small picture-in-picture window

## Technical Details

### WebRTC Implementation
- Uses `simple-peer-light` library for WebRTC peer connections
- STUN servers for NAT traversal
- Signaling through WebSocket server
- Automatic connection establishment

### Video Call Flow
1. **Call Request**: Initiator sends call request through WebSocket
2. **Call Acceptance**: Receiver accepts and establishes peer connection
3. **Signaling**: WebRTC offer/answer exchange through server
4. **Media Stream**: Direct peer-to-peer video/audio streaming
5. **Call Management**: Mute, video toggle, and call termination

### Security Features
- HTTPS required for camera/microphone access
- WebRTC encryption for media streams
- Secure signaling through WebSocket

## Browser Compatibility

The video call feature requires:
- Modern browsers with WebRTC support
- HTTPS connection (for camera/microphone access)
- Camera and microphone permissions

Supported browsers:
- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## Project Structure

```
chess-nextjs/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API routes
│   │   └── page.tsx        # Main page
│   ├── components/         # React components
│   │   ├── Button.tsx
│   │   ├── ChessBoard.tsx
│   │   ├── Game.tsx
│   │   └── VideoCallButton.tsx
│   ├── hooks/             # Custom hooks
│   │   ├── useSocket.ts
│   │   └── useVideoCall.ts
│   ├── lib/               # Server-side logic
│   │   └── game-manager.ts
│   └── types/             # TypeScript types
│       ├── game.ts
│       ├── video.ts
│       └── simple-peer-light.d.ts
├── public/                # Static assets
│   └── *.png             # Chess piece images
├── websocket-server.js   # WebSocket server entry point
├── tsconfig.server.json  # Server TypeScript config
└── next.config.js        # Next.js configuration
```

## Development

### Adding Features
- Video call components are in `src/components/`
- Video call logic is in `src/hooks/useVideoCall.ts`
- Backend signaling is in `src/lib/game-manager.ts`

### Build Process
- `npm run build-server`: Compiles TypeScript server code to `dist/`
- `npm run build`: Builds Next.js application for production
- `npm run dev-full`: Runs everything in development mode

## Deployment

1. **Build the application**
   ```bash
   npm run build-server
   npm run build
   ```

2. **Start the production servers**
   ```bash
   npm run start-server  # WebSocket server
   npm run start         # Next.js server
   ```

## License

This project is licensed under the MIT License.
