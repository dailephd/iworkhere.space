import type { ToolId } from "./type";
import manifest043 from "../../../public/examples/v0.4.3/manifest.json";
import manifest044 from "../../../public/examples/v0.4.4/manifest.json";

/**
 * Descriptive, source-grounded demonstrations for nine existing utilities: five from v0.4.3 and four from v0.4.4.
 * This is not a tool registry: tool identity stays in registry.ts and these records only reference it.
 * Measured facts (bytes, hashes, dimensions, pages) come from the immutable public/examples/v0.4.3 and v0.4.4
 * manifests, which valueExamples.test.ts re-verifies against the committed files. No binary content is stored here.
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
    /** Every file the operation saves, in download order. */
    outputPath: string[];
}
export interface ValueExampleProvenance {
    generator: string;
    permission: string;
    readme: string;
}
export interface ValueExample {
    id: string;
    toolId: ToolId;
    /** True only for the five v0.4.3 tasks the homepage presents; every example still appears on its own tool page. */
    featuredOnHome: boolean;
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
const record = {
    operation: [...manifest043.operation, ...manifest044.operation] as ManifestOperation[],
    asset: [...manifest043.asset, ...manifest044.asset] as ManifestAsset[],
};

const PUBLIC_PREFIX = "public";
const OPTION_LABEL: Record<string, string> = {
    "pdf-to-image:png": "PNG", "pdf-to-image:jpeg": "JPG", "pdf-to-image:150": "150 DPI",
    "image-converter:jpeg": "JPEG", "image-converter:webp": "WebP", "heic-converter:jpeg": "JPEG", "heic-converter:png": "PNG",
};
const bytesText = (value: number) => `${value.toLocaleString("en-US")} bytes`;
const sizeText = (value: ValueExampleAsset) => `${value.width} × ${value.height} px`;
const basename = (value: string) => value.slice(value.lastIndexOf("/") + 1);

const R = "public/examples/v0.4.3/";
const R4 = "public/examples/v0.4.4/";
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
    [`${R4}merge-pdf/source-001.pdf`]: "two-page portrait sample PDF whose pages are labelled A1 and A2",
    [`${R4}merge-pdf/source-002.pdf`]: "three-page landscape sample PDF whose pages are labelled B1, B2 and B3",
    [`${R4}merge-pdf/result.pdf`]: "five-page PDF whose pages are A1, A2, B1, B2 and B3, in that order",
    [`${R4}split-pdf/source.pdf`]: "four-page sample PDF whose pages are labelled P1 to P4, each with its own pale tint",
    [`${R4}split-pdf/result-001.pdf`]: "two-page PDF holding source page 3 and then source page 1 (P3, P1)",
    [`${R4}split-pdf/result-002.pdf`]: "two-page PDF holding source pages 2 and 3 (P2, P3)",
    [`${R4}image-compressor/source.jpg`]: "A flat illustration of a red house with a dark roof between two green hills, a yellow sun at the upper right and a brown strip of soil along the bottom, with fine grain over the lower half.",
    [`${R4}image-compressor/compressed.jpg`]: "The same illustration at the same size after lossy compression at Quality 40: the house, hills, sun and soil are clearly the same scene, with the fine grain slightly smoothed.",
    [`${R4}heic-converter/source.heic`]: "synthetic test picture of flat colored shapes on a dark background, stored as a HEIC image",
    [`${R4}heic-converter/converted.jpg`]: "A dark navy picture with a red rectangle at the top left, a white right triangle at the top, a green rectangle at the top right, a small grey bar at the left, a blue rectangle at the bottom left and a yellow circle at the bottom right.",
    [`${R4}heic-converter/converted.png`]: "The same picture as a lossless PNG, with the identical dark navy background and the same six shapes in the same places.",
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
        outputPath: operation.step.filter(step => step.kind === "download").map(step => step.saveAs!),
        reproduction: operation.step.map(step => {
            if (step.kind === "choose-files") return `Under "${step.control}", choose ${step.asset!.map(basename).join(" then ")}.`;
            if (step.kind === "set-text" && step.control === "Quality") return `Move the "Quality" slider to ${step.value}.`;
            if (step.kind === "set-text") return `Enter ${step.value} in "${step.control}".`;
            if (step.kind === "click-button") return `Press "${step.control}".`;
            if (step.kind === "choose-option") return `Set "${step.control}" to ${OPTION_LABEL[`${operation.toolId}:${step.value}`] ?? step.value}.`;
            if (step.kind === "press-button") return `Press "${step.control}" and wait for "${step.waitForHeading}".`;
            return `Select "${step.control}"; the browser saves ${step.filename}.`;
        }),
    }));
}
const provenance = (generator: string, readme = "public/examples/v0.4.3/README.md"): ValueExampleProvenance => ({
    generator,
    permission: "Original to iworkhere.space, generated for this project. No third-party, private, personal or branded content. Free to reuse with the site.",
    readme,
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

const [mergeFirst, mergeSecond] = ["source-001.pdf", "source-002.pdf"].map(name => asset(`${R4}merge-pdf/${name}`));
const mergeOutput = asset(`${R4}merge-pdf/result.pdf`);
const splitSource = asset(`${R4}split-pdf/source.pdf`);
const [splitFirst, splitSecond] = ["result-001.pdf", "result-002.pdf"].map(name => asset(`${R4}split-pdf/${name}`));
const compressorSource = asset(`${R4}image-compressor/source.jpg`);
const compressorOutput = asset(`${R4}image-compressor/compressed.jpg`);
const compressorSaved = compressorSource.bytes - compressorOutput.bytes;
if (compressorSaved <= 0) throw new Error("The image-compressor example must record a verified smaller output; the tool offers no download otherwise.");
const heicSource = asset(`${R4}heic-converter/source.heic`);
const [heicJpeg, heicPng] = ["converted.jpg", "converted.png"].map(name => asset(`${R4}heic-converter/${name}`));
const pointText = (value: ValueExampleAsset, index: number) => `${value.page![index].width} × ${value.page![index].height} points`;

const VALUE_EXAMPLE: ValueExample[] = [
    {
        id: "compress-pdf-example",
        toolId: "compress-pdf",
        featuredOnHome: true,
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
        featuredOnHome: true,
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
        featuredOnHome: true,
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
        featuredOnHome: true,
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
        featuredOnHome: true,
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
    {
        id: "merge-pdf-example",
        toolId: "merge-pdf",
        featuredOnHome: false,
        task: "Join two separate PDFs into one document, in the order you choose, so there is a single file to attach or upload.",
        whyThisTool: "Merge PDF appends every page of each source in the order listed and checks the merged file page by page before it offers the download.",
        operation: operationOf("merge-pdf-example"),
        source: [mergeFirst, mergeSecond],
        output: [mergeOutput],
        sourceFormat: ["PDF"],
        outputFormat: ["PDF"],
        outcome: `A ${mergeFirst.pageCount}-page PDF (${bytesText(mergeFirst.bytes)}) and a ${mergeSecond.pageCount}-page PDF (${bytesText(mergeSecond.bytes)}) became one ${mergeOutput.pageCount}-page PDF of ${bytesText(mergeOutput.bytes)}. Its pages are A1, A2, B1, B2 and B3, in that order. Pages 1 and 2 are ${pointText(mergeOutput, 0)} and pages 3 to 5 are ${pointText(mergeOutput, 2)}.`,
        changed: ["Two files became one, with every page of the second file after every page of the first.", `The page count, from ${mergeFirst.pageCount} and ${mergeSecond.pageCount} to ${mergeOutput.pageCount}.`],
        unchanged: ["The content, size and relative order of every page within its own source.", "The two source PDFs, which the tool never modifies."],
        limitation: ["Merge accepts 2 to 10 PDFs: 10 MiB per file, with 25 MiB and 100 pages in total.", "Only static pages are supported. Metadata, bookmarks, forms and signatures may not be preserved, and the merged file is not compressed.", "Encrypted PDFs are unsupported.", "Running the tool again can save different bytes for the same pages."],
        provenance: provenance("mergeFirstSource() and mergeSecondSource() in script/v044ExampleFixtures.ts, merged by the Merge PDF page in Chromium.", "public/examples/v0.4.4/README.md"),
    },
    {
        id: "split-pdf-example",
        toolId: "split-pdf",
        featuredOnHome: false,
        task: "Pull chosen pages out of a PDF into separate PDFs, in the order you want, without editing the original.",
        whyThisTool: "Split PDF turns each output group you define into its own verified PDF. Pages keep the order you list them and groups may overlap.",
        operation: operationOf("split-pdf-example"),
        source: [splitSource],
        output: [splitFirst, splitSecond],
        sourceFormat: ["PDF"],
        outputFormat: ["PDF"],
        outcome: `The ${splitSource.pageCount}-page source (${bytesText(splitSource.bytes)}) became two independent PDFs. Group 1, entered as 3,1, holds page 3 and then page 1 (${bytesText(splitFirst.bytes)}). Group 2, entered as 2-3, holds pages 2 and 3 (${bytesText(splitSecond.bytes)}). Page 3 is in both because groups may overlap.`,
        changed: ["One file became two PDFs, one per output group, each downloaded on its own.", "In group 1 the pages are in the order typed, 3 before 1, not in source order."],
        unchanged: ["The size and visible content of every selected page.", "The source PDF, which the tool never modifies."],
        limitation: ["Up to 20 output groups from a source of at most 100 pages and 10 MiB. Each group is a separate download; there is no ZIP file.", "A comma list keeps the order you type, but a range must ascend: 3-1 is rejected, so use 3,2,1.", "Within one group a repeated page is included once.", "Only static pages are supported, and encrypted PDFs are unsupported."],
        provenance: provenance("splitSource() in script/v044ExampleFixtures.ts, split by the Split PDF page in Chromium.", "public/examples/v0.4.4/README.md"),
    },
    {
        id: "image-compressor-example",
        toolId: "image-compressor",
        featuredOnHome: false,
        task: "Make a JPEG smaller for an email, a form or a web page without changing its pixel dimensions.",
        whyThisTool: "Image Compressor re-encodes the image at the quality you choose, keeps its format and dimensions, and offers a download only when the result is actually smaller.",
        operation: operationOf("image-compressor-example"),
        source: [compressorSource],
        output: [compressorOutput],
        sourceFormat: ["JPEG"],
        outputFormat: ["JPEG"],
        outcome: `At Quality 40 the ${sizeText(compressorSource)} JPEG of ${bytesText(compressorSource.bytes)} became ${bytesText(compressorOutput.bytes)}, ${bytesText(compressorSaved)} (${(compressorSaved / compressorSource.bytes * 100).toFixed(1)}%) smaller, still a ${sizeText(compressorOutput)} JPEG. This is the saving for this one grainy picture, not a typical rate.`,
        changed: [`File size, from ${bytesText(compressorSource.bytes)} to ${bytesText(compressorOutput.bytes)}.`, "Fine detail: lossy JPEG compression smooths the grain and can add small artifacts near edges."],
        unchanged: ["Pixel dimensions and the JPEG format.", "The scene: the shapes, their layout and their colors remain clearly the same."],
        limitation: ["The saving depends on the picture and the Quality setting. Other images can shrink by less or not at all.", "When the result is not smaller the tool shows No smaller file produced and offers no download. PNG uses lossless re-encoding and often cannot be reduced.", "One image at a time, at most 25 MiB and 30 megapixels. Metadata preservation is not guaranteed.", "Browser encoders differ, so another browser can save different bytes at the same Quality."],
        provenance: provenance("compressorSourceScene() in script/v044ExampleFixtures.ts, compressed by the Image Compressor page in Chromium.", "public/examples/v0.4.4/README.md"),
    },
    {
        id: "heic-converter-example",
        toolId: "heic-converter",
        featuredOnHome: false,
        task: "Turn a HEIC or HEIF picture from a phone into a JPEG or PNG that ordinary forms, editors and web pages accept.",
        whyThisTool: "HEIC → JPG / PNG Converter decodes the image in a short-lived local worker and re-encodes it at the decoded size in the format you choose.",
        operation: operationOf("heic-converter-example"),
        source: [heicSource],
        output: [heicJpeg, heicPng],
        sourceFormat: ["HEIC"],
        outputFormat: ["JPEG", "PNG"],
        outcome: `The ${sizeText(heicSource)} HEIC image (${bytesText(heicSource.bytes)}) became a JPEG of ${bytesText(heicJpeg.bytes)} at Quality 90 and a PNG of ${bytesText(heicPng.bytes)}, both ${sizeText(heicJpeg)}.`,
        changed: ["The container and encoding: HEIC became lossy JPEG in one run and lossless PNG in the other.", `File size: ${bytesText(heicJpeg.bytes)} as JPEG and ${bytesText(heicPng.bytes)} as PNG, each decided by its encoder.`],
        unchanged: ["Pixel dimensions.", "The layout and colors of the shapes, to within normal JPEG compression tolerance."],
        limitation: ["The source is a small synthetic test picture, not a phone photo. Real photos are larger and take longer to decode.", "One image at a time, at most 25 MiB and 30 megapixels. Complex or unsupported HEIF content may fail to decode.", "Metadata, color profiles and auxiliary images are not preserved. No HEIC transparency guarantee is made, and this sample has no transparency.", "Most browsers cannot display HEIC, so the source is offered as a download only."],
        provenance: {
            generator: "script/v044ExampleFixtures.ts copies the upstream HEIC fixture only after verifying its SHA-256 and Git blob id, then runs the HEIC converter page in Chromium for each output.",
            permission: "The HEIC source is not project-authored. It is the synthetic asym-base.heic test fixture from the su-engineering/heic-web project, pinned to commit 3261b10a, used under that project's MIT license, which is included as LICENSE.txt beside it. The JPEG and PNG are outputs of that fixture. No personal photo is used.",
            readme: "public/examples/v0.4.4/README.md",
        },
    },
];

/** Returns the demonstration for a tool that has one, or undefined for any other tool. */
export function getValueExample(toolId: ToolId): ValueExample | undefined {
    return VALUE_EXAMPLE.find(value => value.toolId === toolId);
}
/** Every demonstration, shown on its own tool page. */
export function getAllValueExample(): ValueExample[] {
    return [...VALUE_EXAMPLE];
}
/** The five demonstrations the homepage presents as task entry points. */
export function getFeaturedValueExample(): ValueExample[] {
    return VALUE_EXAMPLE.filter(value => value.featuredOnHome);
}
