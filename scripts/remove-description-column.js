const { db, dbHelpers } = require('../database/db');

async function removeDescriptionColumn() {
    try {
        console.log('🔄 Removing description column from candidates table...');

        // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
        // Step 1: Create new table without description
        await dbHelpers.run(`
            CREATE TABLE IF NOT EXISTS candidates_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nomination_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (nomination_id) REFERENCES nominations(id),
                UNIQUE(nomination_id, name)
            )
        `);

        // Step 2: Copy data from old table to new table (without description)
        await dbHelpers.run(`
            INSERT INTO candidates_new (id, nomination_id, name, created_at)
            SELECT id, nomination_id, name, created_at
            FROM candidates
        `);

        // Step 3: Drop old table
        await dbHelpers.run('DROP TABLE candidates');

        // Step 4: Rename new table
        await dbHelpers.run('ALTER TABLE candidates_new RENAME TO candidates');

        console.log('✅ Description column removed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error removing description column:', error);
        process.exit(1);
    }
}

removeDescriptionColumn();

