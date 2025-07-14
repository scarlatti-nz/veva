import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sql from '../lib/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initializeDatabase() {
    try {
        console.log('Starting database initialization...');

        // Read all migration files from the migrations directory
        const migrationsDir = path.join(__dirname, 'migrations');
        const files = await fs.readdir(migrationsDir);

        // Sort migration files to ensure they run in order
        const migrationFiles = files
            .filter(f => f.endsWith('.sql'))
            .sort();

        // Create migrations table if it doesn't exist
        await sql`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;

        // Get list of already applied migrations
        const appliedMigrations = await sql`
            SELECT filename FROM migrations;
        `;
        const appliedFilenames = new Set(appliedMigrations.map(m => m.filename));

        // Run each migration that hasn't been applied yet
        for (const filename of migrationFiles) {
            if (!appliedFilenames.has(filename)) {
                console.log(`Applying migration: ${filename}`);

                // Read and execute the migration file
                const filePath = path.join(migrationsDir, filename);
                const migration = await fs.readFile(filePath, 'utf-8');

                // Run the migration within a transaction
                await sql.begin(async sql => {
                    await sql.unsafe(migration);
                    await sql`
                        INSERT INTO migrations (filename)
                        VALUES (${filename});
                    `;
                });

                console.log(`Successfully applied migration: ${filename}`);
            }
        }

        console.log('Database initialization completed successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
}

// Export the initialization function
export default initializeDatabase; 