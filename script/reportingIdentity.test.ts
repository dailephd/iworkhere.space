import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { reportingIdentity } from "./reportingIdentity";

it("keeps the standalone reporting identity artifact equal to canonical metadata", () => {
    expect(JSON.parse(readFileSync("dashboard/src/lib/reportingIdentity.json", "utf8"))).toEqual(reportingIdentity());
});
