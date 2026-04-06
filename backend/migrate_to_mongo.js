const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const mm = require('music-metadata');
const { getMusicDir, NOTES_FILE, MONGO_URI, DB_NAME } = require('./utils/helpers');

// Ensure we are connecting to the right place
console.log('--- Migration Tool ---');
console.log(`MongoDB URI: ${MONGO_URI}`);
console.log(`DB Name: ${DB_NAME}`);
console.log(`Music Dir: ${getMusicDir()}`);
console.log(`Notes File: ${NOTES_FILE}`);

async function migrate() {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection('songs');

        // 1. Load Notes
        console.log('\n1. Reading notes.json...');
        let notes = {};
        if (fs.existsSync(NOTES_FILE)) {
            try {
                notes = JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
                console.log(`   Found ${Object.keys(notes).length} notes.`);
            } catch (e) {
                console.error('   Error reading notes.json:', e.message);
            }
        } else {
            console.log('   notes.json not found.');
        }

        // 2. Scan Music Directory
        console.log('\n2. Scanning music directory...');
        const musicDir = getMusicDir();
        if (!fs.existsSync(musicDir)) {
            console.error(`   Music directory not found: ${musicDir}`);
            return;
        }

        const files = fs.readdirSync(musicDir);
        const musicFiles = files.filter(f => /\.(mp3|wav|flac|m4a|ogg)$/i.test(f));
        console.log(`   Found ${musicFiles.length} music files.`);

        // 3. Process and Upload to MongoDB
        console.log('\n3. Processing files...');
        let count = 0;

        for (const fileName of musicFiles) {
            const filePath = path.join(musicDir, fileName);
            const stats = fs.statSync(filePath);

            // Get metadata (duration)
            let duration = 0;
            try {
                const metadata = await mm.parseFile(filePath);
                duration = metadata.format.duration || 0;
            } catch (e) {
                // console.warn(`   Could not parse metadata for ${fileName}`);
            }

            // Get existing note/cover
            let noteEntry = notes[fileName] || {};
            // Handle string format legacy
            if (typeof noteEntry === 'string') {
                noteEntry = { note: noteEntry, cover: '' };
            }

            const songDoc = {
                name: fileName,
                url: `/music/${encodeURIComponent(fileName)}`, // Local URL
                localPath: filePath,
                size: stats.size,
                datemodified: stats.mtime.toISOString(), // Keep format as string to match old API if needed, or Date object
                duration: duration,
                note: noteEntry.note || '',
                cover: noteEntry.cover || ''
            };

            // Using filename as unique key
            await collection.updateOne(
                { name: fileName },
                { $set: songDoc },
                { upsert: true }
            );

            count++;
            if (count % 20 === 0) process.stdout.write('.');
        }

        console.log(`\n\n✓ Migration completed! Processed ${count} songs.`);

    } catch (err) {
        console.error('\nERROR:', err);
    } finally {
        await client.close();
    }
}

migrate();
