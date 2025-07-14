import { processAndBatchImport } from '../lib/import-utils.js';
import path from 'path'; // Keep path for potential customization

const FRUITION_DATA_DIR = '/app/data/fruition-23359'; // Path inside the container
const MODULE_NAME = 'horticulture_hygiene'; // Module identifier
const LOG_PREFIX = '[Fruition Import]';

// Supported extensions for Fruition
const supportedExtensions = {
    '.pdf': { extractFunc: async (fp) => (await import('../lib/import-utils.js')).extractTextFromPDF(fp), type: 'document' },
    '.pptx': { extractFunc: async (fp) => (await import('../lib/import-utils.js')).extractTextFromPPTX(fp), type: 'presentation' },
};

// Customization function for Fruition metadata (example: specific tagging)
function customizeFruitionMetadata(metadata, filePath) {
    // Example: Add specific tags based on title
    const titleLower = metadata.title.toLowerCase();
    if (titleLower.includes('hygiene')) metadata.tags.push('hygiene');
    if (titleLower.includes('safety')) metadata.tags.push('safety');
    if (titleLower.includes('lesson plan')) metadata.tags.push('lesson plan');
    if (titleLower.includes('workbook')) metadata.tags.push('workbook');
    if (titleLower.includes('exemplar')) metadata.tags.push('exemplar');

    // Add the module name as a tag as well
    metadata.tags.push(MODULE_NAME);

    // Ensure unique tags
    metadata.tags = [...new Set(metadata.tags)];

    return metadata;
}

// Main function called from server startup
async function importFruitionMaterials(client) {
    try {
        await processAndBatchImport({
            client: client,
            directory: FRUITION_DATA_DIR,
            moduleName: MODULE_NAME,
            logPrefix: LOG_PREFIX,
            recursive: false, // Fruition files are directly in the directory
            supportedExtensions: supportedExtensions,
            customizeMetadata: customizeFruitionMetadata
        });
    } catch (error) {
        console.error(`${LOG_PREFIX} An unexpected error occurred during the import process:`, error);
        // Log error but don't stop server
    }
}

export { importFruitionMaterials };

// // Optional: Allow running this script directly for testing/manual import
// if (process.argv[1] === fileURLToPath(import.meta.url)) {
//     (async () => {
//         const { connectWithRetry } = await import('../lib/weaviate-schema.js');
//         let client;
//         try {
//             // Use environment variables or defaults for direct connection
//             const weaviateHost = process.env.WEAVIATE_HOST || 'localhost'; // Adjust as needed
//             const weaviatePort = process.env.WEAVIATE_PORT || 8087;
//             client = await connectWithRetry({ httpHost: weaviateHost, httpPort: weaviatePort });
//             await initializeSchema(client);
//             await importFruitionMaterials(client);
//         } catch (error) {
//             console.error('Manual import script failed:', error);
//             process.exit(1);
//         } finally {
//              // Weaviate JS client v4 doesn't have an explicit close method in the example
//             // if (client && client.close) {
//             //     await client.close();
//             // }
//         }
//     })();
// } 