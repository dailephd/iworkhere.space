import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";

export async function migrateObservability(): Promise<void> {
    const url = process.env.OBSERVABILITY_DATABASE_URL;
    if (!url) throw new Error("OBSERVABILITY_DATABASE_URL is required; migration was not run.");
    const directory = new URL("../database/observability/", import.meta.url);
    const migration = readdirSync(directory).filter(name => /^\d{3}-[a-z0-9-]+\.sql$/.test(name)).sort();
    if (migration.length === 0) throw new Error("No observability migrations found.");
    try {
        const sql = neon(url, { fetchOptions: { signal: AbortSignal.timeout(30_000) } });
        for (const name of migration) {
            const schema = readFileSync(new URL(name, directory), "utf8");
            await sql.transaction(schema.split("-- statement-break").filter(statement => statement.trim()).map(statement => sql.query(statement, [])));
        }
    } catch {
        throw new Error("Observability migration failed: check database connectivity and schema-owner privileges. Database diagnostics are withheld.");
    }
    process.stdout.write("Observability schema migration completed.\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    migrateObservability().catch(error => {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
    });
}
