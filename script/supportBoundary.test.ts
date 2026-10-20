import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REPORT_CATEGORY, SUPPORT_LIMIT } from "../src/module/support/contract";
import { loopbackEndpoint } from "../src/module/support/neon.server";

/** Static source boundaries that keep support data out of telemetry and server code out of the browser. */
function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(directory, entry.name);
        return entry.isDirectory() ? sourceFiles(full) : [full];
    });
}
const production = (directory: string) => sourceFiles(directory).filter(file => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file));
const read = (file: string) => readFileSync(file, "utf8");
const supportModule = production("src/module/support");
const supportComponent = production("src/component/support");
const supportRoute = production("src/app/api/support");

describe("support data never reaches telemetry owners", () => {
    it.each([...supportModule, ...supportComponent, ...supportRoute])("%s imports no observability, analytics or logging owner", file => {
        const source = read(file);
        expect(source).not.toMatch(/from ["']@\/module\/(observability|analytics|log|ad)\b/);
        expect(source).not.toMatch(/from ["'](\.\.\/)+module\/(observability|analytics|log)/);
        expect(source).not.toMatch(/@vercel\/analytics|trackEvent|logEvent|captureError|sendBeacon|\/api\/(metric|log)\b/);
    });
    it("uses console only for the fixed support-operation message", () => {
        const offenders = supportModule.filter(file => /console\.(log|info|warn|debug|trace)/.test(read(file)));
        expect(offenders).toEqual([]);
        const errorUsers = supportModule.filter(file => /console\.error/.test(read(file))).map(file => path.basename(file));
        expect(errorUsers).toEqual(["operation.server.ts"]);
    });
    it("writes no browser storage, cookie or cache", () => {
        for (const file of [...supportModule, ...supportComponent]) {
            expect(read(file), file).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie|caches\.|from ["']@\/lib\/storage["']|navigator\.serviceWorker/);
        }
    });
});

describe("server-only code stays out of the browser", () => {
    const clientFiles = [...supportModule, ...supportComponent].filter(file => /^["']use client["']/.test(read(file).trimStart()));
    it("identifies the client entry points", () => {
        expect(clientFiles.map(file => path.basename(file)).sort()).toEqual(["SupportCoordinator.tsx", "SupportDialog.tsx", "TurnstileChallenge.tsx", "submission.client.ts"]);
    });
    it.each(clientFiles)("%s imports no server module and reads no private environment variable", file => {
        const source = read(file);
        expect(source).not.toMatch(/from ["'][^"']*\.server["']/);
        expect(source).not.toMatch(/from ["']node:|@neondatabase|server-only/);
        expect(source).not.toMatch(/process\.env\.(?!NEXT_PUBLIC_)/);
    });
    it("marks every .server module server-only and keeps credentials out of client-reachable files", () => {
        for (const file of supportModule.filter(item => item.endsWith(".server.ts"))) expect(read(file), file).toMatch(/^import "server-only";/);
        for (const file of supportModule.filter(item => !item.endsWith(".server.ts"))) expect(read(file), file).not.toMatch(/SUPPORT_(DATABASE|WORKER|TURNSTILE_SECRET|GITHUB|RESEND|EMAIL|OPERATOR)|CRON_SECRET/);
    });
    it("reads support secrets only inside server modules", () => {
        for (const file of [...supportComponent, ...production("src/app").filter(item => !item.includes(`${path.sep}api${path.sep}support`))]) {
            expect(read(file), file).not.toMatch(/process\.env\.SUPPORT_(?!DATABASE_URL)/);
        }
    });
});

describe("route adapters stay thin", () => {
    it("delegate to the support domain without inline validation or SQL", () => {
        for (const file of supportRoute) {
            const source = read(file);
            expect(source, file).toMatch(/from "@\/module\/support\//);
            expect(source, file).not.toMatch(/SELECT |INSERT |JSON\.parse|neon\(/);
            expect(source.split("\n").length, file).toBeLessThan(25);
        }
    });
});

describe("contract constants shared by every layer", () => {
    it("pins the request cap and category count that the API, dialog and database agree on", () => {
        expect(SUPPORT_LIMIT.bodyBytes).toBe(16 * 1024);
        expect([SUPPORT_LIMIT.description, SUPPORT_LIMIT.expected, SUPPORT_LIMIT.observed, SUPPORT_LIMIT.email]).toEqual([2000, 1000, 1000, 254]);
        expect(REPORT_CATEGORY).toHaveLength(9);
        const sql = readFileSync("database/support/001-schema.sql", "utf8");
        for (const category of REPORT_CATEGORY) expect(sql).toContain(`'${category}'`);
    });
    it("never lets a non-loopback database endpoint override reach the browser or production", () => {
        expect(loopbackEndpoint("https://attacker.example/sql")).toBeNull();
        expect(loopbackEndpoint("http://127.0.0.1:4010/sql")).toBe("http://127.0.0.1:4010/sql");
    });
});
