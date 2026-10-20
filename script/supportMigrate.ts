import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";

/** Explicit, operator-run migration of the support schema only. Never runs at application startup. */
export async function migrateSupport(): Promise<void> {
    const url = process.env.SUPPORT_MIGRATION_DATABASE_URL;
    if (!url) throw new Error("SUPPORT_MIGRATION_DATABASE_URL is required; migration was not run.");
    const directory = new URL("../database/support/", import.meta.url);
    const migration = readdirSync(directory).filter(name => /^\d{3}-[a-z0-9-]+\.sql$/.test(name)).sort();
    if (migration.length === 0) throw new Error("No support migrations found.");
    try {
        const sql = neon(url, { fetchOptions: { signal: AbortSignal.timeout(30_000) } });
        for (const name of migration) {
            const schema = readFileSync(new URL(name, directory), "utf8");
            await sql.transaction(schema.split("-- statement-break").filter(statement => statement.trim()).map(statement => sql.query(statement, [])));
        }
    } catch {
        throw new Error("Support migration failed: check database connectivity and schema-owner privileges. Database diagnostics are withheld.");
    }
    process.stdout.write("Support schema migration completed.\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    migrateSupport().catch(error => {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
    });
}
