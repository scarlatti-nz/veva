import weaviate from 'weaviate-client';

async function connectWithRetry({
    httpHost = 'localhost',
    httpPort = 8087,
    grpcHost = 'localhost',
    grpcPort = 50051,
    httpSecure = false,
    grpcSecure = false,
    headers = {},
    maxAttempts = 5,
    delay = 5000
} = {}) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log(`Attempting to connect to Weaviate at ${httpHost}:${httpPort} (attempt ${attempt}/${maxAttempts})...`);
            const client = await weaviate.connectToCustom({
                httpHost,
                httpPort,
                grpcHost,
                grpcPort,
                httpSecure,
                grpcSecure,
                headers
            });
            console.log('Successfully connected to Weaviate');
            return client;
        } catch (error) {
            console.error(`Connection attempt ${attempt} failed:`, error.message);
            if (attempt === maxAttempts) {
                throw new Error(`Failed to connect to Weaviate after ${maxAttempts} attempts`);
            }
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

const schemaConfig = {
    class: 'CourseMaterial',
    description: 'Educational materials for the dairy farming contract milking course',
    vectorizer: 'text2vec-openai',
    moduleConfig: {
        'text2vec-openai': {
            model: 'text-embedding-3-small',
            modelVersion: '3.0.0',
            type: 'text',
        }
    },
    properties: [
        {
            name: 'title',
            description: 'Title of the course material section',
            dataType: ['text'],
        },
        {
            name: 'content',
            description: 'The actual content of the course material',
            dataType: ['text'],
        },
        {
            name: 'module',
            description: 'The course module this material belongs to',
            dataType: ['string'],
            moduleConfig: {
                'text2vec-openai': {
                    skip: true,
                }
            },
        },
        {
            name: 'tags',
            description: 'Keywords or topics covered in this material',
            dataType: ['text[]'],
        },
        {
            name: 'type',
            description: 'Type of material (e.g., definition, example, case_study)',
            dataType: ['string'],
            moduleConfig: {
                'text2vec-openai': {
                    skip: true,
                }
            },
        },
        {
            name: 'sourceFile',
            description: 'The original filename of the imported material',
            dataType: ['string'],
            moduleConfig: {
                'text2vec-openai': {
                    skip: true, // Do not vectorize the filename
                }
            },
        }
    ],
};

async function initializeSchema(client) {
    try {
        // Check if schema exists

        const exists = await client.collections.exists('CourseMaterial');

        if (!exists) {
            console.log('Creating Weaviate schema...');
            await client.collections.createFromSchema(schemaConfig);
            console.log('Schema created successfully');
        } else {
            console.log('Schema already exists');
        }
    } catch (error) {
        console.error('Error initializing schema:', error);
        throw error;
    }
}

async function searchMaterials(client, query, { module, type, limit = 5 } = {}) {
    try {
        console.log('Searching materials...', query, module, type, limit);
        const courseMaterials = client.collections.get('CourseMaterial');
        const results = await courseMaterials.query
            .nearText(query, { limit })
        return results.objects;
    } catch (error) {
        console.error('Error searching materials:', error);
        throw error;
    }
}

async function batchImportMaterials(client, materials) {
    try {
        const courseMaterials = client.collections.get('CourseMaterial');
        const batchSize = 1000;
        let totalCount = 0;

        // Process materials in batches
        for (let i = 0; i < materials.length; i += batchSize) {
            const batch = materials.slice(i, i + batchSize);
            try {
                await courseMaterials.data.insertMany(batch);
                totalCount += batch.length;
                console.log(`Batch inserted successfully (${totalCount}/${materials.length} documents)`);
            } catch (error) {
                console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
                throw error;
            }
        }

        return totalCount;
    } catch (error) {
        console.error('Error batch importing materials:', error);
        throw error;
    }
}

// Add a new function to check if a file has already been imported
async function checkIfImported(client, sourceFile) {
    try {
        const courseMaterials = client.collections.get('CourseMaterial');
        const result = await courseMaterials.query.fetchObjects({
            limit: 1,
            filters: courseMaterials.filter.byProperty('sourceFile').equal(sourceFile)
        });
        return result.objects.length > 0;
    } catch (error) {
        console.error(`Error checking import status for ${sourceFile}:`, error);
        // Decide how to handle errors - maybe assume not imported to allow retry?
        // For now, let's re-throw to make the issue visible
        throw error;
    }
}

export { connectWithRetry, initializeSchema, searchMaterials, batchImportMaterials, checkIfImported };
