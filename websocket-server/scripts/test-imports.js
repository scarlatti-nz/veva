import { connectWithRetry, searchMaterials } from '../lib/weaviate-schema.js';


async function testImports() {
    let client;
    try {
        console.log('Connecting to Weaviate...');
        client =  await connectWithRetry();
        
        // Get the CourseMaterial collection
        const courseMaterials = client.collections.get('CourseMaterial');
        
        // Test 1: Count total documents
        const totalCount = await courseMaterials.length();
        console.log(`\nTotal documents in collection: ${totalCount}`);
        
        // Test 2: Get document types distribution
        const typeAgg = await courseMaterials.aggregate
            .groupBy.overAll({ groupBy: 'type' })
            
        console.log('\nDocument types distribution:');
        typeAgg.forEach(record => {
            console.log(`- ${record.groupedBy.type}: ${record.totalCount}`);
        });
        
        // Test 3: Get module distribution
        const moduleAgg = await courseMaterials.aggregate
            .groupBy.overAll({ groupBy: 'module' })
            
        console.log('\nModule distribution:');
        moduleAgg.forEach(record => {
            console.log(`- ${record.groupedBy.module}: ${record.totalCount}`);
        });
        
       
        
        // Test 5: Semantic search test
        console.log('\nTesting semantic search:');
        const searchQueries = [
            'contract milking basics',
            'financial planning',
            'legal requirements'
        ];
        
        for (const query of searchQueries) {
            console.log(`\nSearching for: "${query}"`);
            const results = await searchMaterials(client, query, {
                module: null,
                type: null,
                limit: 3
            });
                
            results.forEach(doc => {
                console.log(`- ${doc.properties.title} (${doc.properties.type})\n${doc.properties.content}\n\n`);
            });
        }
    } catch (error) {
        console.error('Error testing imports:', error);
        process.exit(1);
    } finally {
        if (client) {
            await client.close();
            console.log('\nConnection closed');
        }
    }
}

// Run the tests
testImports();

