const { db, dbHelpers } = require('../database/db');

async function addImageUrlColumn() {
    try {
        console.log('🔄 Adding image_url column to candidates table...');

        // SQLite doesn't support ADD COLUMN IF NOT EXISTS in older versions
        // So we'll check if column exists first
        const tableInfo = await dbHelpers.all('PRAGMA table_info(candidates)');
        const hasImageUrl = tableInfo.some(col => col.name === 'image_url');

        if (hasImageUrl) {
            console.log('✅ image_url column already exists');
            process.exit(0);
        }

        // Add image_url column
        await dbHelpers.run(`
            ALTER TABLE candidates 
            ADD COLUMN image_url TEXT
        `);

        console.log('✅ image_url column added successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error adding image_url column:', error);
        process.exit(1);
    }
}

addImageUrlColumn();

