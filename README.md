# Audio Broadcasting Application

A simple real-time audio broadcasting web application that allows users to broadcast audio streams from their browser and listen to live broadcasts.

## Features

- **Broadcasting Page**: Start live audio streams with microphone selection and audio preview
- **Listening Page**: Connect to and listen to active broadcasts
- **Real-time Communication**: WebSocket signaling for peer discovery
- **WebRTC Audio Streaming**: Direct peer-to-peer audio transmission
- **Audio Visualization**: Real-time audio level monitoring
- **Simple Design**: Clean, straightforward interface

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser to the provided URL

## How to Use

### Broadcasting
1. Navigate to the broadcast page (default route)
2. Allow microphone permissions when prompted
3. Select your preferred microphone from the dropdown
4. Watch the audio preview monitor to see your voice levels
5. Click "Start Broadcasting" to go live
6. See connected listeners count in real-time

### Listening
1. Click the "Listen" button in the top-right corner
2. Wait for available broadcasters to appear
3. Click "Connect to Stream" when a broadcaster is online
4. Use the volume slider to adjust audio levels
5. Enjoy the live audio stream

## Technical Architecture

- **Frontend**: React 18 with TypeScript, Wouter routing, Tailwind CSS
- **Backend**: Express.js with WebSocket server
- **Real-time**: WebRTC for peer-to-peer audio streaming
- **Signaling**: WebSocket for connection coordination
- **Storage**: In-memory storage (ready for database upgrade)

## Project Structure

```
├── client/
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── pages/         # Application pages
│   │   └── lib/           # Utilities
├── server/
│   ├── index.ts          # Server entry point
│   ├── routes.ts         # WebSocket and API routes
│   ├── storage.ts        # Data storage layer
│   └── vite.ts           # Vite integration
└── shared/
    └── schema.ts         # Shared data types
```

## Browser Requirements

- Modern browsers with WebRTC support (Chrome, Firefox, Safari, Edge)
- Microphone access for broadcasting
- Secure context (HTTPS in production) for WebRTC

## Development

The application uses a single port setup where Vite serves the frontend and Express handles the backend APIs and WebSocket connections.

## Credits

Developed by Shepherd Zsper Phiri