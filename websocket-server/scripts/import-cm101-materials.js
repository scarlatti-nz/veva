import { processAndBatchImport } from '../lib/import-utils.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CM101_DATA_DIR = '/app/data/cm101'; // Path inside the container
const DEFAULT_MODULE = 'general'; // Default module if not extracted from path
const LOG_PREFIX = '[CM101 Import]';

// Supported extensions for CM101 - Uses default from utils, but could override
// const supportedExtensions = { ... };

// Customization function for CM101 metadata
function customizeCM101Metadata(metadata, filePath) {
    // Extract module from directory structure relative to CM101_DATA_DIR
    const relativePath = path.relative(CM101_DATA_DIR, filePath);
    const pathParts = relativePath.split(path.sep);
    metadata.module = pathParts.length > 1 ? pathParts[0] : DEFAULT_MODULE;

    // Add module as a tag
    metadata.tags.push(metadata.module);

    // For markdown, look for specific metadata comments (example)
    if (metadata.type === 'markdown' && metadata.content) {
        const lines = metadata.content.split('\n');
        const metadataRegex = /^<!--\s*(\w+):\s*(.+?)\s*-->/;
        metadata.content = lines.filter(line => {
            const match = line.match(metadataRegex);
            if (match) {
                const [_, key, value] = match;
                if (key === 'tags') {
                    metadata.tags.push(...value.split(',').map(t => t.trim()));
                } else if (key === 'type') {
                    metadata.type = value.trim(); // Allow overriding type
                }
                return false; // Remove metadata line from content
            }
            return true;
        }).join('\n').trim();
    }

    // Ensure unique tags
    metadata.tags = [...new Set(metadata.tags)];

    // Example: Customize title further if needed
    // metadata.title = metadata.title.replace(/some-pattern/g, '');

    return metadata;
}

// Main function called from server startup
async function importCM101Materials(client) {
    try {
        await processAndBatchImport({
            client: client,
            directory: CM101_DATA_DIR,
            moduleName: DEFAULT_MODULE, // Base module, will be overridden by customizeMetadata
            logPrefix: LOG_PREFIX,
            recursive: true, // CM101 includes subdirectories
            // supportedExtensions: defaultSupportedExtensions, // Using default from utils
            customizeMetadata: customizeCM101Metadata
        });
    } catch (error) {
        console.error(`${LOG_PREFIX} An unexpected error occurred during the import process:`, error);
        // Log error but don't stop server
    }
}

export { importCM101Materials };

// Remove the direct execution block as this will be called by server.js
// // if (process.argv[1] === fileURLToPath(import.meta.url)) { ... } 