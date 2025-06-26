# Audio Broadcast Application

## Overview

This is a real-time audio broadcasting application that allows users to broadcast audio streams and listen to live broadcasts. The application is built with a React frontend and Express backend, using WebRTC for peer-to-peer audio streaming and WebSockets for signaling.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state management
- **UI Components**: Radix UI with Tailwind CSS for styling
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Server**: Express.js with TypeScript
- **WebSocket**: Native WebSocket server for real-time signaling
- **WebRTC**: Peer-to-peer connections for audio streaming
- **Storage**: In-memory storage implementation with interface for future database integration

### Database Architecture
- **ORM**: Drizzle ORM configured for PostgreSQL
- **Schema**: Users and broadcasts tables defined
- **Migration**: Drizzle Kit for schema management
- **Current State**: Using in-memory storage, database schema prepared for future implementation

## Key Components

### Audio Broadcasting System
- **Broadcaster Page**: Allows users to start/stop audio broadcasts with microphone selection
- **Listener Page**: Enables users to discover and listen to active broadcasts
- **WebRTC Integration**: Direct peer-to-peer audio streaming between broadcasters and listeners
- **Audio Visualization**: Real-time audio level monitoring and visualization

### Real-time Communication
- **WebSocket Signaling**: Handles WebRTC negotiation and connection management
- **Connection Management**: Tracks active broadcasters and listeners
- **Message Routing**: Routes signaling messages between peers

### User Interface
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Component Library**: Comprehensive UI components from Radix UI
- **Audio Controls**: Microphone selection, volume control, and broadcast management
- **Visual Feedback**: Audio level indicators and connection status

## Data Flow

1. **Broadcast Initiation**: User selects microphone and starts broadcast
2. **Registration**: WebSocket registers broadcaster with signaling server
3. **Discovery**: Listeners receive notifications of available broadcasts
4. **Connection**: WebRTC peer connections established between broadcaster and listeners
5. **Streaming**: Direct audio streaming via WebRTC data channels
6. **Management**: Real-time connection status and participant tracking

## External Dependencies

### Core Technologies
- **@neondatabase/serverless**: PostgreSQL database driver
- **drizzle-orm**: Type-safe database ORM
- **ws**: WebSocket implementation for real-time communication
- **@radix-ui/react-***: Comprehensive UI component library

### Audio/Media APIs
- **MediaDevices API**: Microphone access and audio capture
- **WebRTC API**: Peer-to-peer audio streaming
- **AudioContext API**: Audio processing and visualization

### Development Tools
- **Vite**: Build tool and development server
- **TanStack Query**: Server state management
- **Tailwind CSS**: Utility-first CSS framework

## Deployment Strategy

### Development Environment
- **Runtime**: Node.js 20 with ES modules
- **Development Server**: Vite dev server with HMR
- **Database**: PostgreSQL 16 (configured but not yet implemented)

### Production Build
- **Frontend**: Vite build generating optimized static assets
- **Backend**: esbuild bundling server code for production
- **Deployment**: Replit autoscale deployment target

### Environment Configuration
- **Port Configuration**: Local port 5000 mapped to external port 80
- **Module System**: ES modules throughout the application
- **TypeScript**: Strict type checking enabled

## Changelog

```
Changelog:
- June 26, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```