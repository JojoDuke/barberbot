import { LibSQLStore } from '@mastra/libsql';

async function checkDb() {
    const store = new LibSQLStore({
        url: 'file:mastra.db',
    });

    try {
        const client = (store as any).client;
        const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
        console.log('Tables found:', tables.rows.map((r: any) => r.name));

        for (const table of tables.rows) {
            const name = table.name;
            const count = await client.execute(`SELECT count(*) as count FROM ${name}`);
            console.log(`Table ${name} count:`, count.rows[0].count);

            if (name === 'messages' || name.includes('message')) {
                const rows = await client.execute(`SELECT * FROM ${name} LIMIT 5`);
                console.log(`Sample from ${name}:`, JSON.stringify(rows.rows, null, 2));
            }
        }
    } catch (err) {
        console.error('Error reading DB:', err);
    }
}

checkDb();
