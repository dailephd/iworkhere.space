import { describe, expect, it } from "vitest";
import { supportDetailQuery, supportHealthQuery, supportJobQuery, supportListQuery, SUPPORT_PAGE_SIZE, SUPPORT_REPORT_ID } from "./supportQuery";

const ID = "SR-0123456789ABCDEF";
const all = () => [supportListQuery(1), supportListQuery(4), supportHealthQuery(), supportDetailQuery(ID), supportJobQuery(ID)];

describe("support dashboard queries", () => {
    it("are SELECT-only statements", () => {
        for (const query of all()) {
            expect(query.text.trim()).toMatch(/^SELECT\b/);
            expect(query.text).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|COPY|EXECUTE|CALL|SET\s+ROLE)\b/i);
            expect(query.text).not.toContain(";");
        }
    });
    it("read only the dashboard views, never the tables, functions or the observability schema", () => {
        for (const query of all()) {
            expect(query.text).toMatch(/FROM support\.dashboard_(report|job|health)\b/);
            expect(query.text).not.toMatch(/support\.(report|outbox_job)\b/);
            expect(query.text).not.toMatch(/support\.(claim_jobs|job_payload|complete_job|fail_job|purge_expired|delete_report|submit_report)/);
            expect(query.text).not.toMatch(/observability\./);
        }
    });
    it("bind every variable as a parameter and never interpolate it", () => {
        const hostile = "SR-0123456789ABCDEF'; DROP TABLE support.report; --";
        expect(supportDetailQuery(hostile).text).not.toContain("DROP");
        expect(supportDetailQuery(hostile).parameter).toEqual([hostile]);
        expect(supportJobQuery(hostile).parameter).toEqual([hostile]);
        expect(supportListQuery(Number.NaN).parameter).toEqual([String(SUPPORT_PAGE_SIZE + 1), "0"]);
        expect(supportListQuery(3).parameter).toEqual([String(SUPPORT_PAGE_SIZE + 1), String(2 * SUPPORT_PAGE_SIZE)]);
        expect(supportListQuery(-5).parameter[1]).toBe("0");
        expect(supportListQuery(2.9).parameter[1]).toBe(String(SUPPORT_PAGE_SIZE));
    });
    it("keep narrative text out of the list projection", () => {
        const text = supportListQuery(1).text;
        expect(text).not.toMatch(/description|expected|observed|contact_email/);
        expect(supportDetailQuery(ID).text).toMatch(/description/);
    });
    it("validates the opaque report reference format", () => {
        expect(SUPPORT_REPORT_ID.test(ID)).toBe(true);
        for (const bad of ["", "sr-0123456789ABCDEF", "SR-0123456789ABCDE", "SR-0123456789ABCDEFG", "SR-ILOU000000000000", "../support", "SR-0123456789ABCDEF/x"]) expect(SUPPORT_REPORT_ID.test(bad), bad).toBe(false);
    });
});
