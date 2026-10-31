import { describe, expect, it } from "vitest";
import { getAllOperationalWorkflow, getAllWorkflow, getOperationalWorkflow, getWorkflow, workflow_definition_list } from "./registry";

const EXPECTED_SLUG_LIST = ["prepare-image-for-upload", "heic-photos-to-pdf", "assemble-pdf-packet", "pdf-pages-for-slides"];

describe("workflow registry", () => {
    it("lists exactly the four frozen slugs once and in order", () => {
        const slugList = getAllWorkflow().map(workflow => workflow.slug);
        expect(slugList).toEqual(EXPECTED_SLUG_LIST);
        expect(new Set(slugList).size).toBe(4);
        expect(getAllWorkflow()).toBe(workflow_definition_list);
    });

    it("makes all four workflows operational and resolves each through the operational lookup", () => {
        expect(getAllOperationalWorkflow().map(workflow => workflow.slug)).toEqual(EXPECTED_SLUG_LIST);
        for (const slug of EXPECTED_SLUG_LIST) {
            expect(getWorkflow(slug)?.status).toBe("operational");
            expect(getOperationalWorkflow(slug)?.slug).toBe(slug);
        }
    });

    it("freezes the ordered stage identities of the three multi-file workflows", () => {
        expect(getWorkflow("heic-photos-to-pdf")?.stageList).toEqual(["validate", "inspect", "convert", "assemble", "verify", "complete"]);
        expect(getWorkflow("assemble-pdf-packet")?.stageList).toEqual(["validate", "inspect", "select-pages", "assemble", "compress", "verify", "complete"]);
        expect(getWorkflow("pdf-pages-for-slides")?.stageList).toEqual(["validate", "inspect", "select-pages", "render", "verify", "complete"]);
    });

    it("derives each canonical path from its slug and gives unknown slugs no definition", () => {
        for (const workflow of getAllWorkflow()) expect(workflow.canonicalPath).toBe(`/workflows/${workflow.slug}`);
        expect(getWorkflow("not-a-workflow")).toBeUndefined();
        expect(getOperationalWorkflow("not-a-workflow")).toBeUndefined();
        expect(getOperationalWorkflow("")).toBeUndefined();
        expect(getOperationalWorkflow("__proto__")).toBeUndefined();
    });

    it("freezes the first workflow's ordered stage identities", () => {
        expect(getWorkflow("prepare-image-for-upload")?.stageList).toEqual(["validate", "inspect", "convert", "resize", "compress", "verify", "complete"]);
    });

    it("gives every workflow a title, a description and a final complete stage after verify", () => {
        for (const workflow of getAllWorkflow()) {
            expect(workflow.title.length).toBeGreaterThan(0);
            expect(workflow.description.length).toBeGreaterThan(0);
            expect(workflow.stageList.at(-1)).toBe("complete");
            expect(workflow.stageList.at(-2)).toBe("verify");
        }
    });
});
