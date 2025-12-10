const { initDatabase, dbHelpers } = require('../database/db');
const bcrypt = require('bcryptjs');

async function initializeDatabase() {
    try {
        console.log('🔄 Initializing database...');
        await initDatabase();

        // Check if admin user exists
        const admin = await dbHelpers.get('SELECT * FROM users WHERE username = ?', ['admin']);
        
        if (!admin) {
            console.log('👤 Creating default admin user...');
            const password_hash = await bcrypt.hash('admin123', 10);
            await dbHelpers.run(
                'INSERT INTO users (username, password_hash, display_name, is_admin) VALUES (?, ?, ?, ?)',
                ['admin', password_hash, 'Administrator', 1]
            );
            console.log('✅ Admin user created:');
            console.log('   Username: admin');
            console.log('   Password: admin123');
            console.log('   ⚠️  Please change the password after first login!');
        }

        // Check if nominations exist
        const nominations = await dbHelpers.all('SELECT * FROM nominations');
        
        if (nominations.length === 0) {
            console.log('📋 Creating default nominations...');
            const defaultNominations = [
                { name: 'Лучший друг года', description: 'Самый надежный и верный друг' },
                { name: 'Душа компании', description: 'Тот, кто всегда поднимает настроение' },
                { name: 'Самый креативный', description: 'Гений идей и творчества' },
                { name: 'Лучший организатор', description: 'Мастер планирования и событий' },
                { name: 'Самый веселый', description: 'Король шуток и смеха' },
                { name: 'Лучший советчик', description: 'Мудрый наставник и помощник' },
                { name: 'Самый активный', description: 'Энергия и энтузиазм' },
                { name: 'Лучший слушатель', description: 'Тот, кто всегда выслушает' }
            ];

            for (const nom of defaultNominations) {
                await dbHelpers.run(
                    'INSERT INTO nominations (name, description) VALUES (?, ?)',
                    [nom.name, nom.description]
                );
            }
            console.log(`✅ Created ${defaultNominations.length} default nominations`);
        }

        console.log('✅ Database initialization complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        process.exit(1);
    }
}

initializeDatabase();

