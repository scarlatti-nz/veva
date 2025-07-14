import { connectWithRetry } from '../lib/weaviate-schema.js';

async function testConnection() {
    let client;
    try {
        console.log('Testing connection to Weaviate...');
        
        client = await connectWithRetry({
            httpHost: 'localhost',
            httpPort: 8087,
            grpcHost: 'localhost',
            grpcPort: 50051,
            httpSecure: false,
            grpcSecure: false,
            headers: {
                'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY || ''
            }
        });

        // Test by getting list of collections
        const collections = await client.collections.listAll();
        console.log('\nConnection successful!');
        console.log('Available collections:', collections.length ? collections.map(c => c.name).join(', ') : 'None');

        // Test getting a specific collection if it exists
        if (collections.some(c => c.name === 'CourseMaterial')) {
            const courseCollection = client.collections.get('CourseMaterial');
            const count = await courseCollection.count();
            console.log(`Number of documents in CourseMaterial collection: ${count}`);
        }
        
    } catch (error) {
        console.error('Connection test failed:', error);
        process.exit(1);
    } finally {
        // Close the client connection
        if (client) {
            await client.close();
            console.log('\nConnection closed');
        }
    }
}

testConnection(); 