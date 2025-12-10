const { db, dbHelpers } = require('../database/db');

async function addVideoUrlColumn() {
    try {
        console.log('🔄 Adding video_url column to candidates table...');

        // SQLite doesn't support ADD COLUMN IF NOT EXISTS in older versions
        // So we'll check if column exists first
        const tableInfo = await dbHelpers.all('PRAGMA table_info(candidates)');
        const hasVideoUrl = tableInfo.some(col => col.name === 'video_url');

        if (hasVideoUrl) {
            console.log('✅ video_url column already exists');
            process.exit(0);
        }

        // Add video_url column
        await dbHelpers.run(`
            ALTER TABLE candidates 
            ADD COLUMN video_url TEXT
        `);

        console.log('✅ video_url column added successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error adding video_url column:', error);
        process.exit(1);
    }
}

addVideoUrlColumn();

