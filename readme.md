# Realtime Voice Chat Application

This project is a realtime voice chat application built with React, TypeScript, and Vite on the frontend, and a Node.js WebSocket server on the backend. It leverages OpenAI's Realtime API for voice processing and conversation management.

This readme covers how to get the project running. For a more detailed description of the code structure, see `docs/architecture.md`.

## Features

- Realtime voice oral assessment
- Assessment and feedback for user answers
- Audio visualization for both user and AI responses

## Project Structure

The application is composed of several services orchestrated by Docker Compose:

1. Frontend – React, TypeScript & Vite (`/frontend`)
2. WebSocket Server – Node.js (`/websocket-server`)
3. NGINX – reverse proxy that serves the frontend and routes websocket traffic (`/nginx`)
4. PostgreSQL – relational database used by the backend (container-only)
5. Weaviate – vector database for semantic search (container-only)

### Frontend

The frontend is located in the `frontend` directory and is built using React, TypeScript, and Vite.

Key files:

- `src/pages/ConsolePage.tsx`: Main component handling UI and logic for voice chat
- `vite.config.ts`: Vite configuration file
- `src/App.tsx`: Root component
- `src/main.tsx`: Entry point for the React application

### WebSocket Server

The WebSocket server is located in the `websocket-server` directory.

Key files:

- `server.js`: Entry point for the WebSocket server
- `lib/relay.js`: Handles WebSocket connections and relays messages between client and OpenAI's Realtime API

## Local Development (without Docker Compose)

1. Clone the repository
2. Install dependencies for both frontend and websocket-server:
   ```
   cd frontend && npm install
   cd ../websocket-server && npm install
   ```
3. Create a `.env` file in the `websocket-server` directory with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```
4. Start the WebSocket server:
   ```
   cd websocket-server && node server.js
   ```
5. Start the frontend development server:
   ```
   cd frontend && npm run dev
   ```

## Running with Docker Compose (recommended)

Prerequisites: Docker 20.10+ and Docker Compose v2 or later.

1. Create a `.env` file in the project root and supply at least your `OPENAI_API_KEY`. The compose file exposes additional optional variables (e.g. DigitalOcean Spaces credentials, Postgres connection settings, `LOG_LEVEL`). Defaults are suitable for local development.
2. Place course material files in `data/cm101` and `data/fruition-23359`. These will be uploaded to the Weaviate database when the relay server is started.
3. Build and start all services:

   ```bash
   docker compose up --build
   ```

   The first run will download and build all images; subsequent runs will be much faster.

4. Once all containers report healthy, open your browser at **http://localhost:8000**.

Exposed ports

| Service          | Host Port | Description               |
| ---------------- | --------- | ------------------------- |
| NGINX / Frontend | 8000      | Main web UI & API gateway |
| PostgreSQL       | 5432      | Relational database       |
| Weaviate REST    | 8087      | Vector DB REST endpoint   |
| Weaviate gRPC    | 50051     | Vector DB gRPC endpoint   |

Hot-reloading is enabled for the `frontend` service via bind mounts, so any code changes will be reflected immediately.

## Usage

1. Open the application in your browser:
   - Local development: http://localhost:3000
   - Docker Compose: http://localhost:8000
2. Click the "Connect" button to start a new conversation
3. Use the "Push to talk" button
4. Interact with the AI assistant using voice input
