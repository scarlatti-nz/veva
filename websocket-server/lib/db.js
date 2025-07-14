import postgres from 'postgres';
import initializeDatabase from '../db/init.js';

// Create the SQL connection
const sql = postgres({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: process.env.POSTGRES_SSL === 'true' ? 'require' : false,
});

// Initialize the database when this module is imported
initializeDatabase()
    .then(() => console.log('Database initialized successfully'))
    .catch(error => {
        console.error('Failed to initialize database:', error);
        process.exit(1);
    });

export default sql; 