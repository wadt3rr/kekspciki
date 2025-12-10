const { db, dbHelpers, initDatabase } = require('../database/db');

async function migrateDatabase() {
    try {
        console.log('🔄 Starting database migration...');

        // Check if candidates table exists
        const candidatesTable = await dbHelpers.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='candidates'"
        );

        if (!candidatesTable) {
            console.log('📋 Creating candidates table...');
            await dbHelpers.run(`
                CREATE TABLE IF NOT EXISTS candidates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nomination_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (nomination_id) REFERENCES nominations(id),
                    UNIQUE(nomination_id, name)
                )
            `);
            console.log('✅ Candidates table created');
        }

        // Check if votes table has candidate_id column
        const votesTableInfo = await dbHelpers.all("PRAGMA table_info(votes)");
        const hasCandidateId = votesTableInfo.some(col => col.name === 'candidate_id');
        const hasCandidateName = votesTableInfo.some(col => col.name === 'candidate_name');

        if (!hasCandidateId && hasCandidateName) {
            console.log('🔄 Migrating votes table...');
            
            // Create new votes table with candidate_id
            await dbHelpers.run(`
                CREATE TABLE IF NOT EXISTS votes_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    nomination_id INTEGER NOT NULL,
                    candidate_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (nomination_id) REFERENCES nominations(id),
                    FOREIGN KEY (candidate_id) REFERENCES candidates(id),
                    UNIQUE(user_id, nomination_id)
                )
            `);

            // Migrate existing votes if any
            const oldVotes = await dbHelpers.all('SELECT * FROM votes');
            if (oldVotes.length > 0) {
                console.log(`📊 Found ${oldVotes.length} existing votes. They will need to be recreated with candidates.`);
                console.log('⚠️  Note: Old votes cannot be automatically migrated. Please recreate them.');
            }

            // Drop old table and rename new one
            await dbHelpers.run('DROP TABLE IF EXISTS votes');
            await dbHelpers.run('ALTER TABLE votes_new RENAME TO votes');
            console.log('✅ Votes table migrated');
        } else if (hasCandidateId) {
            console.log('✅ Votes table already migrated');
        }

        console.log('✅ Database migration complete!');
        console.log('');
        console.log('📝 Next steps:');
        console.log('1. Add candidates to nominations using the API or directly in the database');
        console.log('2. Users will need to vote again (old votes cannot be migrated automatically)');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrateDatabase();

