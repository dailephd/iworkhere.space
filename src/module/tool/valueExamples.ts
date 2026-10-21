import type { ToolId } from "./type";
import manifest from "../../../public/examples/v0.4.3/manifest.json";

/**
 * Descriptive, source-grounded demonstrations for five existing utilities.
 * This is not a tool registry: tool identity stays in registry.ts and these records only reference it.
 * Measured facts (bytes, hashes, dimensions, pages) come from public/examples/v0.4.3/manifest.json, which
 * valueExamples.test.ts re-verifies against the committed files. No binary content is stored here.
 */
export interface ValueExampleAsset {
    /** Repository-relative path of the committed public file. */
    path: string;
    /** Site-relative URL that serves the same file. */
    url: string;
    mediaType: string;
    bytes: number;
    sha256: string;
    /** What the committed file shows (images) or contains (PDFs), written from inspecting the file itself. */
    description: string;
    role: "source" | "output";
    operation: string | null;
    width?: number;
    height?: number;
    pageCount?: number;
    page?: { width: number; height: number; rotation: number }[];
}
export interface ValueExampleOperation {
    id: string;
    summary: string;
    /** Instructions using the labels of the real tool controls, in the order they were executed. */
    reproduction: string[];
    outputPath: string;
}
export interface ValueExampleProvenance {
    generator: string;
    permission: string;
    readme: string;
}
export interface ValueExample {
    id: string;
    toolId: ToolId;
    task: string;
    whyThisTool: string;
    operation: ValueExampleOperation[];
    source: ValueExampleAsset[];
    output: ValueExampleAsset[];
    sourceFormat: string[];
    outputFormat: string[];
    outcome: string;
    changed: string[];
    unchanged: string[];
    limitation: string[];
    provenance: ValueExampleProvenance;
}

interface ManifestStep { kind: string; control: string; asset?: string[]; value?: string; filename?: string; saveAs?: string; waitForHeading?: string }
interface ManifestOperation { id: string; exampleId: string; toolId: string; summary: string; step: ManifestStep[] }
interface ManifestAsset {
    path: string; exampleId: string; role: "source" | "output"; operation: string | null; mediaType: string; bytes: number; sha256: string;
    width?: number; height?: number; pageCount?: number; page?: { width: number; height: number; rotation: number }[];
}
const record = manifest as { operation: ManifestOperation[]; asset: ManifestAsset[] };

const PUBLIC_PREFIX = "public";
const OPTION_LABEL: Record<string, string> = {
    "pdf-to-image:png": "PNG", "pdf-to-image:jpeg": "JPG", "pdf-to-image:150": "150 DPI",
    "image-converter:jpeg": "JPEG", "image-converter:webp": "WebP",
};
const bytesText = (value: number) => `${value.toLocaleString("en-US")} bytes`;
const sizeText = (value: ValueExampleAsset) => `${value.width} × ${value.height} px`;
const basename = (value: string) => value.slice(value.lastIndexOf("/") + 1);

const R = "public/examples/v0.4.3/";
/*
 * Descriptions come from viewing each committed file and probing its pixels; valueExamples.test.ts re-checks the
 * transparency claims against the bytes. They are keyed by path so the measured manifest stays untouched.
 * Images read as sentences (used for alt text and captions); PDFs read as noun phrases (used in the download link name).
 */
const DESCRIPTION: Record<string, string> = {
    [`${R}compress-pdf/source.pdf`]: "two-page sample PDF with a weekly study log and a reading list",
    [`${R}compress-pdf/processed.pdf`]: "the same two pages after lossless structural compression",
    [`${R}pdf-to-image/source.pdf`]: "two-page sample PDF whose pages are labelled Page 1 and Page 2",
    [`${R}pdf-to-image/page-001.png`]: "Page 1 of the sample PDF: a pale blue page with a small \"Page 1\" label on the left and a large dark blue numeral 1 in the middle.",
    [`${R}pdf-to-image/page-002.jpg`]: "Page 2 of the sample PDF in landscape, because that page is stored rotated 90 degrees: a pale peach page with an orange circle holding a white numeral 2, and a small sideways \"Page 2\" label.",
    [`${R}images-to-pdf/source-001.png`]: "An orange rectangle with a narrow white vertical bar, forming a numeral 1, surrounded by a transparent margin.",
    [`${R}images-to-pdf/source-002.jpg`]: "A solid teal image with a large, blocky white numeral 2 in the middle.",
    [`${R}images-to-pdf/result.pdf`]: "two-page PDF with the orange 1 image on page 1 and the teal 2 image on page 2",
    [`${R}image-resizer/source.png`]: "A test card on a cream background with a faint grid and a thin dark border: a small square in each corner (red top left, teal top right, blue bottom left, amber bottom right), a large purple ring in the middle, a blue triangle on the left and a teal rectangle at the lower right.",
    [`${R}image-resizer/resized.png`]: "The same test card at half the width and height: the corner squares, purple ring, blue triangle and teal rectangle sit in the same relative places, only smaller.",
    [`${R}image-converter/source.png`]: "Three flat shapes on a transparent background: a red ring with a see-through centre on the left, a blue rectangle at the upper right and a teal triangle below it. A viewer shows its own page color behind the transparent areas.",
    [`${R}image-converter/converted.jpg`]: "The same three shapes on a solid white background. JPEG cannot store transparency, so the transparent background and the ring's centre became white.",
    [`${R}image-converter/converted.webp`]: "The same three shapes with the transparent background and the ring's see-through centre kept, because WebP can store transparency.",
};

function asset(path: string): ValueExampleAsset {
    const found = record.asset.find(value => value.path === path);
    if (!found) throw new Error(`Missing example asset ${path}`);
    const description = DESCRIPTION[path];
    if (!description) throw new Error(`Missing verified description for example asset ${path}`);
    return { ...found, description, url: found.path.slice(PUBLIC_PREFIX.length) };
}
function assetOf(exampleId: string, role: "source" | "output"): ValueExampleAsset[] {
    return record.asset.filter(value => value.exampleId === exampleId && value.role === role).map(value => asset(value.path));
}
function operationOf(exampleId: string): ValueExampleOperation[] {
    return record.operation.filter(value => value.exampleId === exampleId).map(operation => ({
        id: operation.id,
        summary: operation.summary,
        outputPath: operation.step.find(step => step.kind === "download")!.saveAs!,
        reproduction: operation.step.map(step => {
            if (step.kind === "choose-files") return `Under "${step.control}", choose ${step.asset!.map(basename).join(" then ")}.`;
            if (step.kind === "set-text") return `Enter ${step.value} in "${step.control}".`;
            if (step.kind === "choose-option") return `Set "${step.control}" to ${OPTION_LABEL[`${operation.toolId}:${step.value}`] ?? step.value}.`;
            if (step.kind === "press-button") return `Press "${step.control}" and wait for "${step.waitForHeading}".`;
            return `Select "${step.control}"; the browser saves ${step.filename}.`;
        }),
    }));
}
const provenance = (generator: string): ValueExampleProvenance => ({
    generator,
    permission: "Original to iworkhere.space, generated for this project. No third-party, private, personal or branded content. Free to reuse with the site.",
    readme: "public/examples/v0.4.3/README.md",
});

const compressSource = asset("public/examples/v0.4.3/compress-pdf/source.pdf");
const compressOutput = asset("public/examples/v0.4.3/compress-pdf/processed.pdf");
const compressSaved = compressSource.bytes - compressOutput.bytes;
if (compressSaved <= 0) throw new Error("The compress-pdf example must record a verified smaller output; the tool offers no download otherwise.");

const imageToPdfOutput = asset("public/examples/v0.4.3/images-to-pdf/result.pdf");
const [pdfPng, pdfJpg] = ["page-001.png", "page-002.jpg"].map(name => asset(`public/examples/v0.4.3/pdf-to-image/${name}`));
const [firstImage, secondImage] = ["source-001.png", "source-002.jpg"].map(name => asset(`public/examples/v0.4.3/images-to-pdf/${name}`));
const resizeSource = asset("public/examples/v0.4.3/image-resizer/source.png");
const resizeOutput = asset("public/examples/v0.4.3/image-resizer/resized.png");
const convertSource = asset("public/examples/v0.4.3/image-converter/source.png");
const [convertJpg, convertWebp] = ["converted.jpg", "converted.webp"].map(name => asset(`public/examples/v0.4.3/image-converter/${name}`));

const VALUE_EXAMPLE: ValueExample[] = [
    {
        id: "compress-pdf-example",
        toolId: "compress-pdf",
        task: "Make a small, text-and-vector PDF smaller before attaching it, without altering what the pages show.",
        whyThisTool: "Compress PDF rewrites the file structure only. It never changes the page content, so it suits documents that must look and read exactly as authored.",
        operation: operationOf("compress-pdf-example"),
        source: [compressSource],
        output: [compressOutput],
        sourceFormat: ["PDF"],
        outputFormat: ["PDF"],
        outcome: `The ${compressSource.pageCount}-page source of ${bytesText(compressSource.bytes)} became ${bytesText(compressOutput.bytes)}, ${bytesText(compressSaved)} (${(compressSaved / compressSource.bytes * 100).toFixed(1)}%) smaller. The tool offers the download only because the result was smaller.`,
        changed: [`File size, from ${bytesText(compressSource.bytes)} to ${bytesText(compressOutput.bytes)}.`, "Internal object layout and stream compression."],
        unchanged: ["Page count and page sizes.", "The 90 degree rotation of page 2.", "Every text item and the rendered appearance of each page."],
        limitation: ["This is one small document. Other PDFs may shrink by more, less or not at all.", "When the result is not smaller, the tool reports no reduction and offers no download.", "Encrypted PDFs are unsupported."],
        provenance: provenance("compressPdfSource() in script/v043ExampleFixtures.ts, processed by the production QPDF 12.4.2 arguments through the Compress PDF page."),
    },
    {
        id: "pdf-to-image-example",
        toolId: "pdf-to-image",
        task: "Turn individual PDF pages into images for a slide, a chat message or a web page.",
        whyThisTool: "PDF to JPG / PNG renders the pages you choose locally and downloads each as its own image, in the format and resolution you select.",
        operation: operationOf("pdf-to-image-example"),
        source: assetOf("pdf-to-image-example", "source"),
        output: [pdfPng, pdfJpg],
        sourceFormat: ["PDF"],
        outputFormat: ["PNG", "JPEG"],
        outcome: `Page 1 became a ${sizeText(pdfPng)} PNG (${bytesText(pdfPng.bytes)}) and page 2 a ${sizeText(pdfJpg)} JPEG (${bytesText(pdfJpg.bytes)}), both at 150 DPI.`,
        changed: ["Each chosen page became a raster image at 150 DPI.", "Page 2 is stored with a 90 degree rotation, so its image is landscape."],
        unchanged: ["The page order and the visible identity of each page.", "The source PDF, which is never modified."],
        limitation: ["Pages are exported one operation at a time, up to 20 images, and each image downloads individually.", "Only 72, 150 and 300 DPI are offered, within the 4096 px side and 16 MP area limits.", "JPEG output is lossy and flattens transparency onto white."],
        provenance: provenance("pdfToImageSource() in script/v043ExampleFixtures.ts, rendered by the PDF to JPG / PNG page in Chromium."),
    },
    {
        id: "images-to-pdf-example",
        toolId: "images-to-pdf",
        task: "Combine separate pictures into one PDF, one picture per page, in a chosen order.",
        whyThisTool: "Images to PDF embeds each JPEG or PNG on its own page in the order listed, so the result reads as a simple ordered document.",
        operation: operationOf("images-to-pdf-example"),
        source: [firstImage, secondImage],
        output: [imageToPdfOutput],
        sourceFormat: ["PNG", "JPEG"],
        outputFormat: ["PDF"],
        outcome: `${bytesText(firstImage.bytes)} of PNG and ${bytesText(secondImage.bytes)} of JPEG became a ${imageToPdfOutput.pageCount}-page PDF of ${bytesText(imageToPdfOutput.bytes)}. Page 1 is ${imageToPdfOutput.page![0].width} × ${imageToPdfOutput.page![0].height} points and page 2 is ${imageToPdfOutput.page![1].width} × ${imageToPdfOutput.page![1].height} points.`,
        changed: ["Two images became the two pages of one PDF, in the order listed."],
        unchanged: ["Each image keeps its pixel dimensions, used one-to-one as the page size in points.", "The JPEG pixels are embedded as they are."],
        limitation: ["The tool has no paper-size, margin, crop or layout controls: each page matches its image.", "The PNG keeps its transparent margin, so a viewer shows its own page background there.", "WebP images are unsupported."],
        provenance: provenance("imagesToPdfFirstScene() and imagesToPdfSecondScene() in script/v043ExampleFixtures.ts, combined by the Images to PDF page."),
    },
    {
        id: "image-resizer-example",
        toolId: "image-resizer",
        task: "Shrink a picture to a specific width without distorting it.",
        whyThisTool: "Image Resizer derives the matching height from the width while the aspect ratio is preserved, so the picture is scaled rather than stretched.",
        operation: operationOf("image-resizer-example"),
        source: [resizeSource],
        output: [resizeOutput],
        sourceFormat: ["PNG"],
        outputFormat: ["PNG"],
        outcome: `${sizeText(resizeSource)} (${bytesText(resizeSource.bytes)}) became ${sizeText(resizeOutput)} (${bytesText(resizeOutput.bytes)}), still PNG.`,
        changed: ["Width and height, halved together.", "File size, which here is a consequence of the new dimensions and the browser's PNG encoder."],
        unchanged: ["The 4:3 aspect ratio.", "The PNG format and the placement of the shapes and corner markers."],
        limitation: ["A smaller image does not always mean a smaller file.", "The output keeps the source format and is re-encoded by the browser, so its exact bytes can differ between browsers.", "Files are limited to 25 MiB and 30 MP."],
        provenance: provenance("resizerSourceScene() in script/v043ExampleFixtures.ts, resized by the Image Resizer page in Chromium."),
    },
    {
        id: "image-converter-example",
        toolId: "image-converter",
        task: "Change a transparent logo-style PNG into a JPEG for a form that rejects PNG, or into WebP while keeping its transparency.",
        whyThisTool: "JPG / PNG / WebP Converter re-encodes the same pixels in another format locally and makes each format's transparency behavior explicit.",
        operation: operationOf("image-converter-example"),
        source: [convertSource],
        output: [convertJpg, convertWebp],
        sourceFormat: ["PNG"],
        outputFormat: ["JPEG", "WebP"],
        outcome: `The ${sizeText(convertSource)} transparent PNG (${bytesText(convertSource.bytes)}) became a JPEG of ${bytesText(convertJpg.bytes)} with a white background and a WebP of ${bytesText(convertWebp.bytes)} that keeps its transparency, both at the default quality of 90.`,
        changed: ["The file format and encoding.", "In JPEG, transparent pixels are flattened onto white."],
        unchanged: ["Pixel dimensions.", "In WebP, the transparent regions, including the hole in the circle."],
        limitation: ["JPEG cannot store transparency and WebP at quality 90 is lossy, so colors can shift slightly.", "Browser encoders differ, so another browser can produce different bytes and sizes.", "Converted size is not guaranteed to be smaller than the source."],
        provenance: provenance("converterSourceScene() in script/v043ExampleFixtures.ts, converted by the Image Converter page in Chromium."),
    },
];

/** Returns the demonstration for a featured tool, or undefined for any other tool. */
export function getValueExample(toolId: ToolId): ValueExample | undefined {
    return VALUE_EXAMPLE.find(value => value.toolId === toolId);
}
export function getAllValueExample(): ValueExample[] {
    return [...VALUE_EXAMPLE];
}
