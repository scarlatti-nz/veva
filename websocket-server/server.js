import { RealtimeRelay } from './lib/relay.js';
import dotenv from 'dotenv';
dotenv.config({ override: true });
import { getSession as getDtlSession, getTools as getDtlTools, getQuestions as getDtlQuestions } from './chatbots/dtl.js';
import { getSession as getFruitionSession, getTools as getFruitionTools, getQuestions as getFruitionQuestions } from './chatbots/fruition.js';
import { getSession as getFruitionChecklistSession, getTools as getFruitionChecklistTools, getQuestions as getFruitionChecklistQuestions } from './chatbots/fruition-checklist.js';
import { connectWithRetry, initializeSchema } from './lib/weaviate-schema.js';
import { initSentry } from './lib/sentry.js';
import { importFruitionMaterials } from './scripts/import-fruition-materials.js';
import { importCM101Materials } from './scripts/import-cm101-materials.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SENTRY_DSN = process.env.SENTRY_DSN;

if (!OPENAI_API_KEY) {
  console.error(
    `Environment variable "OPENAI_API_KEY" is required.\n` +
    `Please set it in your .env file.`
  );
  process.exit(1);
}

if (SENTRY_DSN) {
  initSentry(SENTRY_DSN);
}

const PORT = parseInt(process.env.PORT) || 8080;

const weaviateClient = await connectWithRetry({
  httpHost: 'weaviate',
  httpPort: 8087,
  grpcHost: 'weaviate',
  grpcPort: 50051,
  httpSecure: false,
  grpcSecure: false
})

// Initialize schema after connection
await initializeSchema(weaviateClient);

// Run the import process after connection
await importFruitionMaterials(weaviateClient);
await importCM101Materials(weaviateClient);

const agentConfigs = {
  'dtl': {
    getSession: getDtlSession,
    getTools: (userData) => getDtlTools(OPENAI_API_KEY, weaviateClient, userData),
    getQuestions: getDtlQuestions
  },
  'fruition': {
    getSession: getFruitionSession,
    getTools: (userData) => getFruitionTools(OPENAI_API_KEY, weaviateClient, userData),
    getQuestions: getFruitionQuestions
  },
  'fruition-checklist': {
    getSession: getFruitionChecklistSession,
    getTools: (userData) => getFruitionChecklistTools(OPENAI_API_KEY, weaviateClient, userData),
    getQuestions: getFruitionChecklistQuestions
  }
};

// Initialize the relay with agent configurations
const relay = new RealtimeRelay(
  OPENAI_API_KEY,
  agentConfigs,
  300000, // timeLimit
  process.env.LOG_LEVEL ?? 2,
  process.env.NODE_ENV === 'production'
);

// Start the relay server
relay.listen(PORT);

