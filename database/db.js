const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'premia.db');

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('✅ Connected to SQLite database');
    }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Initialize database tables
function initDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Users table
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE,
                    password_hash TEXT NOT NULL,
                    display_name TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    is_admin INTEGER DEFAULT 0
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating users table:', err);
                    reject(err);
                }
            });

            // Nominations table
            db.run(`
                CREATE TABLE IF NOT EXISTS nominations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    is_active INTEGER DEFAULT 1
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating nominations table:', err);
                    reject(err);
                }
            });

            // Candidates table
            db.run(`
                CREATE TABLE IF NOT EXISTS candidates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nomination_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    video_url TEXT,
                    image_url TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (nomination_id) REFERENCES nominations(id),
                    UNIQUE(nomination_id, name)
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating candidates table:', err);
                    reject(err);
                }
            });

            // Votes table
            db.run(`
                CREATE TABLE IF NOT EXISTS votes (
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
            `, (err) => {
                if (err) {
                    console.error('Error creating votes table:', err);
                    reject(err);
                } else {
                    console.log('✅ Database tables initialized');
                    resolve();
                }
            });
        });
    });
}

// Database helper functions
const dbHelpers = {
    // Run a query
    run: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    },

    // Get one row
    get: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },

    // Get all rows
    all: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
};

// Initialize database on module load
initDatabase().catch(err => {
    console.error('Failed to initialize database:', err);
});

module.exports = { db, dbHelpers, initDatabase };

