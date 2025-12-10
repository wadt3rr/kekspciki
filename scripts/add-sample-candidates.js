const { dbHelpers } = require('../database/db');

async function addSampleCandidates() {
    try {
        console.log('🔄 Adding sample candidates...');

        // Get nominations
        const nominations = await dbHelpers.all('SELECT id, name FROM nominations WHERE is_active = 1');
        
        if (nominations.length === 0) {
            console.log('❌ No active nominations found. Please create nominations first.');
            process.exit(1);
        }

        console.log(`📋 Found ${nominations.length} nominations`);

        // Sample candidates for each nomination
        const sampleCandidates = [
            { name: 'Иван' },
            { name: 'Мария' },
            { name: 'Алексей' },
            { name: 'Анна' }
        ];

        let added = 0;
        for (const nomination of nominations) {
            console.log(`\n📝 Adding candidates for: ${nomination.name} (id: ${nomination.id})`);
            
            for (const candidate of sampleCandidates) {
                try {
                    // Check if candidate already exists
                    const existing = await dbHelpers.get(
                        'SELECT * FROM candidates WHERE nomination_id = ? AND name = ?',
                        [nomination.id, candidate.name]
                    );

                    if (!existing) {
                        await dbHelpers.run(
                            'INSERT INTO candidates (nomination_id, name) VALUES (?, ?)',
                            [nomination.id, candidate.name]
                        );
                        console.log(`  ✅ Added: ${candidate.name}`);
                        added++;
                    } else {
                        console.log(`  ⏭️  Skipped: ${candidate.name} (already exists)`);
                    }
                } catch (error) {
                    console.error(`  ❌ Error adding ${candidate.name}:`, error.message);
                }
            }
        }

        console.log(`\n✅ Done! Added ${added} candidates.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

addSampleCandidates();

