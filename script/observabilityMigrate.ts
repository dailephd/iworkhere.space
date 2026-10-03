import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";

export async function migrateObservability(): Promise<void> {
    const url = process.env.OBSERVABILITY_DATABASE_URL;
    if (!url) throw new Error("OBSERVABILITY_DATABASE_URL is required; migration was not run.");
    const schema = readFileSync(new URL("../database/observability/001-schema.sql", import.meta.url), "utf8");
    try {
        const sql = neon(url, { fetchOptions: { signal: AbortSignal.timeout(30_000) } });
        await sql.transaction(schema.split("-- statement-break").map(statement => sql.query(statement, [])));
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
