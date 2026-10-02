import { defineConfig } from "vitest/config"
import path from "path"
import crypto from "crypto"

const runId = process.env.VITEST_RUN_ID ?? `${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomBytes(4).toString("hex")}`
const reportDir = path.resolve(__dirname, "test-report", runId)

export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
            "server-only": path.resolve(__dirname, "node_modules/next/dist/compiled/server-only/empty.js"),
        },
    },
    test: {
        environment: "node",
        include: ["src/**/*.test.{ts,tsx}", "script/**/*.test.ts"],
        reporters: ["default", "json", "junit"],
        outputFile: {
            json: path.join(reportDir, "results.json"),
            junit: path.join(reportDir, "results.xml"),
        },
    },
})
