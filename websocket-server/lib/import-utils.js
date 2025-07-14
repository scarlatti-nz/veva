import fs from 'fs/promises';
import path from 'path';

// Fix ESM imports for parsers - ensure these are installed in websocket-server
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import JSZip from 'jszip';
import { DOMParser } from 'xmldom';
import vttToJson from 'vtt-to-json';

// --- PPTX Extraction Logic ---
function getTextFromNodes(node, tagName, namespaceURI) {
    let text = '';
    const textNodes = node.getElementsByTagNameNS(namespaceURI, tagName);
    for (let i = 0; i < textNodes.length; i++) {
        text += textNodes[i].textContent + ' ';
    }
    return text.trim();
}

async function extractTextFromPptxInternal(arrayBuffer) {
    try {
        const zip = new JSZip();
        await zip.loadAsync(arrayBuffer);

        const aNamespace = "http://schemas.openxmlformats.org/drawingml/2006/main";
        let text = '';
        let slideIndex = 1;
        while (true) {
            const slideFile = zip.file(`ppt/slides/slide${slideIndex}.xml`);
            if (!slideFile) break;
            const slideXmlStr = await slideFile.async('text');
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(slideXmlStr, 'application/xml');
            const slideText = getTextFromNodes(xmlDoc, "t", aNamespace);
            if (slideText) {
                text += `[Slide ${slideIndex}]\\n${slideText}\\n\\n`;
            }
            slideIndex++;
        }
        return text.trim();
    } catch (err) {
        console.error('Error extracting text from PPTX:', err);
        return '';
    }
}

export async function extractTextFromPPTX(filePath) {
    try {
        const dataBuffer = await fs.readFile(filePath);
        const text = await extractTextFromPptxInternal(dataBuffer);
        if (!text) {
            console.warn(`No text content extracted from PPTX: ${filePath}`);
            return null; // Return null instead of throwing
        }
        return text;
    } catch (error) {
        console.error(`Error extracting text from PPTX ${filePath}:`, error);
        return null;
    }
}
// --- End PPTX Extraction ---

// --- PDF Extraction Logic ---
export async function extractTextFromPDF(filePath) {
    try {
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
    } catch (error) {
        console.error(`Error extracting text from PDF ${filePath}:`, error);
        return null;
    }
}
// --- End PDF Extraction ---

// --- VTT Extraction Logic ---
export async function extractTextFromVTT(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = await vttToJson(content);
        return parsed.map(item => item.content).join(' ');
    } catch (error) {
        console.error(`Error extracting text from VTT ${filePath}:`, error);
        return null;
    }
}
// --- End VTT Extraction ---

// --- Markdown Extraction Logic ---
export async function extractTextFromMD(filePath) {
    try {
        return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
        console.error(`Error reading Markdown file ${filePath}:`, error);
        return null;
    }
}
// --- End Markdown Extraction ---

// --- Core Importer Logic ---
import { checkIfImported, batchImportMaterials } from './weaviate-schema.js';

const defaultSupportedExtensions = {
    '.pdf': { extractFunc: extractTextFromPDF, type: 'document' },
    '.pptx': { extractFunc: extractTextFromPPTX, type: 'presentation' },
    '.vtt': { extractFunc: extractTextFromVTT, type: 'transcript' },
    '.md': { extractFunc: extractTextFromMD, type: 'markdown' },
};

/**
 * Processes a single file for import.
 * Checks if already imported, extracts content, and generates basic metadata.
 */
async function processFileForImport(filePath, client, supportedExtensions) {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);

    if (!supportedExtensions[ext]) {
        // console.log(`Skipping unsupported file type: ${ext} (${fileName})`);
        return null;
    }

    try {
        const alreadyImported = await checkIfImported(client, fileName);
        if (alreadyImported) {
            // console.log(`Skipping already imported file: ${fileName}`);
            return null;
        }

        console.log(`Processing file for import: ${fileName}`);
        const { extractFunc, type } = supportedExtensions[ext];
        const content = await extractFunc(filePath);

        if (!content) {
            console.warn(`No content extracted from ${fileName}`);
            return null;
        }

        // Basic title extraction (can be overridden by caller)
        let title = path.basename(fileName, ext)
            .replace(/[_-]/g, ' ') // Replace underscores and hyphens
            .replace(/\(?\d+\)?$/, '') // Remove trailing numbers in parentheses
            .replace(/\s+/g, ' ') // Normalize spaces
            .trim();

        return {
            title, // Can be customized later
            content,
            type, // Base type from extension
            sourceFile: fileName,
            tags: [type], // Base tags, can be added to later
            module: '' // Needs to be set by caller
        };

    } catch (error) {
        console.error(`Error processing file ${fileName}:`, error);
        return null;
    }
}

/**
 * Reads a directory, processes supported files, and imports new ones into Weaviate.
 */
export async function processAndBatchImport({
    client,
    directory,
    moduleName,
    logPrefix = '[Import]',
    recursive = false,
    supportedExtensions = defaultSupportedExtensions,
    customizeMetadata = (metadata, filePath) => metadata // Optional function to customize title, tags, module
}) {
    let materialsToImport = [];
    let filesProcessed = 0;
    let errors = 0;

    async function readDirectory(currentDir) {
        try {
            const entries = await fs.readdir(currentDir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                if (entry.isDirectory() && recursive) {
                    await readDirectory(fullPath);
                } else if (entry.isFile()) {
                    filesProcessed++;
                    const processedData = await processFileForImport(fullPath, client, supportedExtensions);
                    if (processedData) {
                        // Assign module and allow customization
                        processedData.module = moduleName;
                        const finalMetadata = customizeMetadata(processedData, fullPath);
                        if (finalMetadata) {
                            materialsToImport.push(finalMetadata);
                        }
                    } else if (processedData === null) {
                        // Already imported or skipped, not an error
                    } else {
                        errors++; // Count processing errors
                    }
                }
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log(`${logPrefix} Directory not found: ${currentDir}. Skipping.`);
                // Consider this non-fatal, maybe the data isn't present
            } else {
                console.error(`${logPrefix} Error reading directory ${currentDir}:`, error);
                errors++; // Count directory reading errors
                // Decide if this should stop the whole import
                throw error; // Re-throw for now to make it visible
            }
        }
    }

    console.log(`${logPrefix} Starting import for module '${moduleName}' from directory: ${directory}`);
    try {
        await readDirectory(directory);

        if (materialsToImport.length > 0) {
            console.log(`${logPrefix} Attempting to import ${materialsToImport.length} new materials for module '${moduleName}'...`);
            const count = await batchImportMaterials(client, materialsToImport);
            console.log(`${logPrefix} Successfully imported ${count} new materials for module '${moduleName}'.`);
            return { processed: filesProcessed, imported: count, errors: errors };
        } else {
            console.log(`${logPrefix} No new materials found to import for module '${moduleName}'. Processed ${filesProcessed} files.`);
            return { processed: filesProcessed, imported: 0, errors: errors };
        }
    } catch (error) {
        console.error(`${logPrefix} Batch import failed for module '${moduleName}':`, error);
        // Log errors but don't necessarily stop server startup
        return { processed: filesProcessed, imported: 0, errors: errors + materialsToImport.length };
    }
} 