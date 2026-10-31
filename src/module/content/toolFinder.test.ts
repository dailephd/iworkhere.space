import { describe, expect, it } from "vitest";
import { GUIDE_ROOT_NODE_ID, getAllGuideNode, getGuideNode } from "./toolFinder";
import type { GuideNode } from "./toolFinder";
import { getAllTool } from "@/module/tool/metadata";
import { getAllOperationalWorkflow, getAllWorkflow } from "@/module/workflow/registry";

const node = getAllGuideNode();
const question = node.flatMap(one => one.kind === "question" ? [one] : []);
const recommendation = node.flatMap(one => one.kind === "recommendation" ? [one] : []);

function childId(one: GuideNode): string[] {
    return one.kind === "question" ? one.choice.map(choice => choice.nextNodeId) : [];
}

describe("guide graph contract (TST-001)", () => {
    it("has 28 unique nodes: one root, five task questions and 22 recommendations", () => {
        expect(node).toHaveLength(28);
        expect(new Set(node.map(one => one.id)).size).toBe(28);
        expect(question.map(one => one.id)).toEqual(["start", "image-task", "pdf-task", "text-task", "converter-task", "developer-task"]);
        expect(recommendation).toHaveLength(22);
        expect(GUIDE_ROOT_NODE_ID).toBe("start");
    });

    it("has the exact root question and seven ordered family edges", () => {
        const root = getGuideNode("start");
        expect(root?.kind).toBe("question");
        if (root?.kind !== "question") return;
        expect(root.prompt).toBe("What do you need to do?");
        expect(root.choice).toEqual([
            { id: "image", label: "Image", nextNodeId: "image-task" },
            { id: "pdf", label: "PDF", nextNodeId: "pdf-task" },
            { id: "text", label: "Text", nextNodeId: "text-task" },
            { id: "converter", label: "Converters", nextNodeId: "converter-task" },
            { id: "developer", label: "Developer", nextNodeId: "developer-task" },
            { id: "math", label: "Math", nextNodeId: "recommend-tool-calculator" },
            { id: "time", label: "Time", nextNodeId: "recommend-tool-time-arithmetic" },
        ]);
    });

    it("has the exact task questions and choice ids", () => {
        const summary = Object.fromEntries(question.slice(1).map(one => [one.id, [one.prompt, one.choice.map(choice => choice.id)]]));
        expect(summary).toEqual({
            "image-task": ["What do you want to do with an image?", ["change-format", "change-dimensions", "reduce-bytes", "convert-heic", "meet-upload-rules", "heic-photos-pdf"]],
            "pdf-task": ["What do you want to do with a PDF?", ["join-whole-pdfs", "extract-pages", "export-page-images", "images-into-pdf", "shrink-pdf", "assemble-pages", "slides"]],
            "text-task": ["What text task do you need?", ["url-slug", "html-text", "count-text"]],
            "converter-task": ["What do you want to convert?", ["length", "weight"]],
            "developer-task": ["Which developer task?", ["json", "qr"]],
        });
    });

    it("has unique non-empty choices per question and no dangling edge", () => {
        const id = new Set(node.map(one => one.id));
        for (const one of question) {
            expect(one.choice.length).toBeGreaterThan(1);
            expect(new Set(one.choice.map(choice => choice.id)).size).toBe(one.choice.length);
            for (const choice of one.choice) {
                expect(choice.label.trim()).not.toBe("");
                expect(id.has(choice.nextNodeId), `${one.id}/${choice.id}`).toBe(true);
            }
        }
    });

    it("reaches every node from the root exactly via authored edges, with no cycle and one parent per node", () => {
        const parentCount = new Map<string, number>();
        for (const one of node) for (const next of childId(one)) parentCount.set(next, (parentCount.get(next) ?? 0) + 1);
        for (const one of node) expect(parentCount.get(one.id) ?? 0, one.id).toBe(one.id === GUIDE_ROOT_NODE_ID ? 0 : 1);

        const visited = new Set<string>();
        function visit(nodeId: string, ancestor: readonly string[]) {
            expect(ancestor.includes(nodeId), `cycle at ${nodeId}`).toBe(false);
            visited.add(nodeId);
            const current = getGuideNode(nodeId);
            for (const next of current ? childId(current) : []) visit(next, [...ancestor, nodeId]);
        }
        visit(GUIDE_ROOT_NODE_ID, []);
        expect(visited.size).toBe(28);
    });

    it("gives every recommendation one target, a one-sentence rationale and an id derived from that target", () => {
        const rationale = recommendation.map(one => one.rationale);
        expect(new Set(rationale).size).toBe(22);
        for (const one of recommendation) {
            expect(one.id).toBe(one.target.kind === "tool" ? `recommend-tool-${one.target.toolId}` : `recommend-workflow-${one.target.workflowSlug}`);
            expect(one.rationale.endsWith("."), one.id).toBe(true);
            expect(one.rationale.slice(0, -1)).not.toMatch(/[.!?]/);
            expect(Object.keys(one.target).sort()).toEqual(one.target.kind === "tool" ? ["kind", "toolId"] : ["kind", "workflowSlug"]);
        }
    });

    it("returns undefined for unknown ids and cannot be mutated through lookups", () => {
        expect(getGuideNode("nope")).toBeUndefined();
        expect(getGuideNode("")).toBeUndefined();
        expect(getGuideNode("__proto__")).toBeUndefined();
        const root = getGuideNode("start");
        expect(Object.isFrozen(root)).toBe(true);
        expect(() => { (root as { id: string }).id = "changed"; }).toThrow(TypeError);
        if (root?.kind === "question") {
            expect(() => { (root.choice as { id: string; label: string; nextNodeId: string }[]).push({ id: "x", label: "x", nextNodeId: "start" }); }).toThrow(TypeError);
            expect(() => { (root.choice[0] as { label: string }).label = "changed"; }).toThrow(TypeError);
        }
        expect(() => { (getAllGuideNode() as GuideNode[]).pop(); }).toThrow(TypeError);
        expect(getGuideNode("start")).toBe(root);
        expect(getAllGuideNode()).toHaveLength(28);
    });
});

describe("guide targets resolve through the registries (TST-002)", () => {
    it("covers each of the 18 registered tools exactly once", () => {
        const toolTarget = recommendation.flatMap(one => one.target.kind === "tool" ? [one.target.toolId] : []);
        expect(toolTarget).toHaveLength(18);
        expect(new Set(toolTarget).size).toBe(18);
        expect([...toolTarget].sort()).toEqual(getAllTool().map(tool => tool.id).sort());
    });

    it("covers each of the four operational workflows exactly once and none is unavailable", () => {
        const workflowTarget = recommendation.flatMap(one => one.target.kind === "workflow" ? [one.target.workflowSlug] : []);
        expect(workflowTarget).toHaveLength(4);
        expect([...workflowTarget].sort()).toEqual(getAllWorkflow().map(workflow => workflow.slug).sort());
        expect(getAllOperationalWorkflow()).toHaveLength(4);
        for (const workflow of getAllWorkflow()) {
            expect(workflow.status).toBe("operational");
            expect(workflow.canonicalPath).toBe(`/workflows/${workflow.slug}`);
        }
    });

    it("never points at a manual guide, category search or the guide itself", () => {
        const text = JSON.stringify(node);
        expect(text).not.toMatch(/\/guide|\/category|\/tool\/|\/workflows\/|http/);
    });
});

describe("one-choice recommendations (TST-003)", () => {
    function pathTo(familyChoiceId: string, taskChoiceId?: string): string {
        const root = getGuideNode("start");
        if (root?.kind !== "question") throw new Error("root");
        const family = root.choice.find(choice => choice.id === familyChoiceId);
        if (!family) throw new Error(familyChoiceId);
        const next = getGuideNode(family.nextNodeId);
        if (next?.kind === "recommendation") return next.id;
        if (next?.kind !== "question" || !taskChoiceId) throw new Error(`${familyChoiceId} needs a task`);
        const task = next.choice.find(choice => choice.id === taskChoiceId);
        if (!task) throw new Error(taskChoiceId);
        return task.nextNodeId;
    }

    it("recommends Math and Time directly after the family choice", () => {
        expect(pathTo("math")).toBe("recommend-tool-calculator");
        expect(pathTo("time")).toBe("recommend-tool-time-arithmetic");
    });

    it("reaches each recommendation within one task choice after the family", () => {
        expect(pathTo("image", "change-format")).toBe("recommend-tool-image-converter");
        expect(pathTo("image", "change-dimensions")).toBe("recommend-tool-image-resizer");
        expect(pathTo("image", "reduce-bytes")).toBe("recommend-tool-image-compressor");
        expect(pathTo("image", "convert-heic")).toBe("recommend-tool-heic-converter");
        expect(pathTo("image", "meet-upload-rules")).toBe("recommend-workflow-prepare-image-for-upload");
        expect(pathTo("image", "heic-photos-pdf")).toBe("recommend-workflow-heic-photos-to-pdf");
        expect(pathTo("pdf", "join-whole-pdfs")).toBe("recommend-tool-merge-pdf");
        expect(pathTo("pdf", "extract-pages")).toBe("recommend-tool-split-pdf");
        expect(pathTo("pdf", "export-page-images")).toBe("recommend-tool-pdf-to-image");
        expect(pathTo("pdf", "images-into-pdf")).toBe("recommend-tool-images-to-pdf");
        expect(pathTo("pdf", "shrink-pdf")).toBe("recommend-tool-compress-pdf");
        expect(pathTo("pdf", "assemble-pages")).toBe("recommend-workflow-assemble-pdf-packet");
        expect(pathTo("pdf", "slides")).toBe("recommend-workflow-pdf-pages-for-slides");
        expect(pathTo("text", "url-slug")).toBe("recommend-tool-slugify");
        expect(pathTo("text", "html-text")).toBe("recommend-tool-html-text-extractor");
        expect(pathTo("text", "count-text")).toBe("recommend-tool-word-character-counter");
        expect(pathTo("converter", "length")).toBe("recommend-tool-length-converter");
        expect(pathTo("converter", "weight")).toBe("recommend-tool-weight-converter");
        expect(pathTo("developer", "json")).toBe("recommend-tool-json-formatter");
        expect(pathTo("developer", "qr")).toBe("recommend-tool-qr-code-generator");
    });

    it("has no question whose choices all lead to the same single recommendation", () => {
        for (const one of question) expect(new Set(one.choice.map(choice => choice.nextNodeId)).size).toBe(one.choice.length);
    });
});
