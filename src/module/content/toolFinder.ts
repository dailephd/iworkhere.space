import type { ToolId } from "@/module/tool/type";
import type { WorkflowSlug } from "@/module/workflow/type";

/* Authored decision graph for the Guide finder. It stores only references (ToolId, WorkflowSlug), questions, choice labels and rationales.
   Names, canonical paths and availability are resolved from the tool and workflow registries by the caller. */

export type GuideTarget =
    | { kind: "tool"; toolId: ToolId }
    | { kind: "workflow"; workflowSlug: WorkflowSlug };

export interface GuideChoice {
    id: string;
    label: string;
    nextNodeId: string;
}

export type GuideNode =
    | { id: string; kind: "question"; prompt: string; choice: readonly GuideChoice[] }
    | { id: string; kind: "recommendation"; target: GuideTarget; rationale: string };

export const GUIDE_ROOT_NODE_ID = "start" as const;

function choice(id: string, label: string, nextNodeId: string): GuideChoice {
    return { id, label, nextNodeId };
}

function question(id: string, prompt: string, choiceList: readonly GuideChoice[]): GuideNode {
    return { id, kind: "question", prompt, choice: choiceList };
}

function toolRecommendation(toolId: ToolId, rationale: string): GuideNode {
    return { id: `recommend-tool-${toolId}`, kind: "recommendation", target: { kind: "tool", toolId }, rationale };
}

function workflowRecommendation(workflowSlug: WorkflowSlug, rationale: string): GuideNode {
    return { id: `recommend-workflow-${workflowSlug}`, kind: "recommendation", target: { kind: "workflow", workflowSlug }, rationale };
}

function freezeNode(node: GuideNode): GuideNode {
    if (node.kind === "question") {
        node.choice.forEach(one => Object.freeze(one));
        Object.freeze(node.choice);
    } else {
        Object.freeze(node.target);
    }
    return Object.freeze(node);
}

const guide_node_list: readonly GuideNode[] = Object.freeze([
    question(GUIDE_ROOT_NODE_ID, "What do you need to do?", [
        choice("image", "Image", "image-task"),
        choice("pdf", "PDF", "pdf-task"),
        choice("text", "Text", "text-task"),
        choice("converter", "Converters", "converter-task"),
        choice("developer", "Developer", "developer-task"),
        choice("math", "Math", "recommend-tool-calculator"),
        choice("time", "Time", "recommend-tool-time-arithmetic"),
    ]),
    question("image-task", "What do you want to do with an image?", [
        choice("change-format", "Change the file format", "recommend-tool-image-converter"),
        choice("change-dimensions", "Change width or height", "recommend-tool-image-resizer"),
        choice("reduce-bytes", "Try to reduce file size", "recommend-tool-image-compressor"),
        choice("convert-heic", "Convert one HEIC or HEIF photo", "recommend-tool-heic-converter"),
        choice("meet-upload-rules", "Meet format, dimensions and maximum-byte rules", "recommend-workflow-prepare-image-for-upload"),
        choice("heic-photos-pdf", "Combine HEIC photos into one PDF", "recommend-workflow-heic-photos-to-pdf"),
    ]),
    question("pdf-task", "What do you want to do with a PDF?", [
        choice("join-whole-pdfs", "Join entire PDF documents", "recommend-tool-merge-pdf"),
        choice("extract-pages", "Extract selected pages into separate PDFs", "recommend-tool-split-pdf"),
        choice("export-page-images", "Turn PDF pages into JPG or PNG images", "recommend-tool-pdf-to-image"),
        choice("images-into-pdf", "Make a PDF from JPEG or PNG images", "recommend-tool-images-to-pdf"),
        choice("shrink-pdf", "Try lossless PDF size reduction", "recommend-tool-compress-pdf"),
        choice("assemble-pages", "Assemble selected PDF pages and images in a chosen order", "recommend-workflow-assemble-pdf-packet"),
        choice("slides", "Prepare PDF pages as images for slides", "recommend-workflow-pdf-pages-for-slides"),
    ]),
    question("text-task", "What text task do you need?", [
        choice("url-slug", "Make URL-safe text", "recommend-tool-slugify"),
        choice("html-text", "Extract text from HTML", "recommend-tool-html-text-extractor"),
        choice("count-text", "Count words and characters", "recommend-tool-word-character-counter"),
    ]),
    question("converter-task", "What do you want to convert?", [
        choice("length", "Length or distance", "recommend-tool-length-converter"),
        choice("weight", "Weight or mass", "recommend-tool-weight-converter"),
    ]),
    question("developer-task", "Which developer task?", [
        choice("json", "Format or validate JSON", "recommend-tool-json-formatter"),
        choice("qr", "Generate a QR code", "recommend-tool-qr-code-generator"),
    ]),
    toolRecommendation("image-converter", "Changes an image between JPEG, PNG and WebP; a different format does not guarantee a smaller file."),
    toolRecommendation("image-resizer", "Changes the pixel dimensions of an image and keeps its format, but it cannot restore detail that is not there."),
    toolRecommendation("image-compressor", "Tries to produce an image with fewer bytes, without any guarantee of reaching an exact size."),
    toolRecommendation("heic-converter", "Converts one HEIC or HEIF photo into a supported JPEG or PNG image."),
    workflowRecommendation("prepare-image-for-upload", "Checks the format, the maximum dimensions and the byte cap you set, and reports honestly which requirement is still unmet."),
    workflowRecommendation("heic-photos-to-pdf", "Processes your selected HEIC photos in the order you choose and builds them into one PDF."),
    toolRecommendation("merge-pdf", "Joins entire PDF documents into one PDF in the order you choose."),
    toolRecommendation("split-pdf", "Writes the page groups you choose as separate PDF outputs."),
    toolRecommendation("pdf-to-image", "Turns the selected PDF pages into JPEG or PNG images, within the supported resolution limits."),
    toolRecommendation("images-to-pdf", "Turns JPEG or PNG images into the pages of one PDF."),
    toolRecommendation("compress-pdf", "Applies structural lossless optimization, which may not make a given file smaller."),
    workflowRecommendation("assemble-pdf-packet", "Interleaves the PDF pages and images you choose into one ordered PDF and checks the result."),
    workflowRecommendation("pdf-pages-for-slides", "Renders chosen PDF pages as one or more verified slide-ready images, within the supported format, resolution and optional size limits."),
    toolRecommendation("slugify", "Produces lowercase, hyphenated ASCII slugs; transliteration of non-Latin text is not guaranteed."),
    toolRecommendation("html-text-extractor", "Extracts readable text from HTML; it does not sanitize the HTML."),
    toolRecommendation("word-character-counter", "Counts words, characters and lines in your text without interpreting the document."),
    toolRecommendation("length-converter", "Converts between the supported length units only."),
    toolRecommendation("weight-converter", "Converts between the supported weight units only."),
    toolRecommendation("json-formatter", "Formats, minifies and validates strict JSON and never executes any of it."),
    toolRecommendation("qr-code-generator", "Encodes the text or URL you enter as a QR code and does not verify where it leads."),
    toolRecommendation("calculator", "Does basic arithmetic on ordinary JavaScript numbers."),
    toolRecommendation("time-arithmetic", "Adds and subtracts HH:MM durations; it does not handle time zones or dates."),
].map(freezeNode));

export function getAllGuideNode(): readonly GuideNode[] {
    return guide_node_list;
}

export function getGuideNode(nodeId: string): GuideNode | undefined {
    return guide_node_list.find(node => node.id === nodeId);
}
