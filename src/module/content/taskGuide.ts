import type { ToolId } from "@/module/tool/type";

/*
 * Four authored, multi-tool task guides. This is not a tool registry: every tool is referenced by ToolId only and
 * is resolved to its name and URL through the registry by the server routes. Prose therefore describes actions and
 * outcomes without naming a tool. Measured sample facts stay in valueExamples.ts; nothing here is fetched or computed.
 */
export type TaskGuideSlug =
    | "assemble-pdf-packet"
    | "prepare-image-for-upload"
    | "heic-photos-to-pdf"
    | "pdf-pages-for-slides";

export interface TaskGuideStep {
    heading: string;
    explanation: string;
    toolId?: ToolId;
}

export interface TaskGuide {
    slug: TaskGuideSlug;
    title: string;
    description: string;
    startingMaterial: string;
    expectedOutcome: string;
    step: TaskGuideStep[];
    exampleToolId: ToolId[];
    verification: string[];
    limitation: string[];
    relatedToolId: ToolId[];
    /** The date the content was last checked against the working tools, as YYYY-MM-DD. It is not an update timer. */
    reviewedOn: string;
}

const TASK_GUIDE: TaskGuide[] = [
    {
        slug: "assemble-pdf-packet",
        title: "Assemble an Ordered PDF Packet",
        description: "Pick pages from several PDFs, turn a picture into a page if needed, and merge everything into one PDF whose page order you check yourself.",
        startingMaterial: "Two or more supported PDFs, and optionally a JPEG or PNG that should become one more page of the packet.",
        expectedOutcome: "One PDF whose pages appear in the order you chose, with a page count and a visible page order that you confirmed in a PDF viewer.",
        step: [
            { heading: "Decide the final page order on paper first", explanation: "Write down which source file and page goes where, for example A1, A2, then B3, then the scanned receipt. Every later step only follows this list, and it is also your checklist at the end." },
            { heading: "Extract only the pages you need from a long PDF", explanation: "Enter the pages in the order you want, such as 3,1 to put page 3 before page 1. Each output group becomes its own PDF and groups may overlap. Save each result with its download button; nothing is sent on to the next step for you.", toolId: "split-pdf" },
            { heading: "Turn a picture page into a PDF", explanation: "If part of the packet is a JPEG or PNG, add it here, keep the order of the list, and create a one-page PDF. Save it with its download button. A picture page takes the pixel size of the image as its page size.", toolId: "images-to-pdf" },
            { heading: "Select the prepared files and fix their order", explanation: "Open the merge page and choose the files you saved in the previous steps by hand. Use Move up and Move down until the displayed list matches your written order, then merge and download the result. Pages of one source keep their relative order.", toolId: "merge-pdf" },
            { heading: "Optionally try a lossless size reduction last", explanation: "Run the finished packet through structural compression only if the size matters. Do it last so the earlier steps work on the original files. The result is offered only when it is smaller; otherwise you are told that no reduction was achieved, and you keep the packet you already have.", toolId: "compress-pdf" },
        ],
        exampleToolId: ["split-pdf", "merge-pdf"],
        verification: [
            "Open the downloaded packet and confirm the page count equals the sum of the pages you chose.",
            "Scroll through it and compare each page, one by one, with your written order. The sample pages carry visible labels (A1, A2, B1, B2, B3) so a swap is obvious.",
            "Check that the packet opens without a password prompt and that pages in a different size or orientation still look correct.",
        ],
        limitation: [
            "Merging accepts 2 to 10 PDFs of at most 10 MiB each, with 25 MiB and 100 pages in total. Splitting accepts one PDF of up to 100 pages and 10 MiB, with up to 20 output groups.",
            "Every result is a separate download, and each next step needs you to select the saved file yourself. There is no ZIP file and nothing is passed along automatically.",
            "Only static pages are supported. Signatures, bookmarks, interactive form fields, document metadata and accessibility tags may not survive, and an encrypted PDF is rejected.",
            "This is page assembly, not editing. It cannot redact content, remove a signature or convert Office documents.",
        ],
        relatedToolId: ["split-pdf", "images-to-pdf", "merge-pdf", "compress-pdf"],
        reviewedOn: "2026-10-27",
    },
    {
        slug: "prepare-image-for-upload",
        title: "Prepare an Image for an Upload",
        description: "Check an image against an example upload rule for format, size in pixels and size in bytes, adjust it step by step, and read the result honestly.",
        startingMaterial: "A supported image (JPEG, PNG or WebP) and an illustrative rule to meet: JPEG format, at most 800 × 600 pixels and at most 100,000 bytes. The rule is an example and does not come from any real upload form.",
        expectedOutcome: "A downloaded image that you checked against all three limits, or a clear statement of which limit it still misses and what to try next.",
        step: [
            { heading: "Write down the rule and measure the original", explanation: "Note the required format, the largest allowed width and height, and the byte limit. Look at the properties of your file to learn its current format, pixel size and byte size so you know which limit actually needs work." },
            { heading: "Change the format only if it is wrong", explanation: "If the file is not a JPEG, convert it. JPEG cannot store transparency, so transparent areas are filled with white. Skip this step when the file is already a JPEG, and download the result if you used it.", toolId: "image-converter" },
            { heading: "Resize to fit inside the pixel limits", explanation: "Select the file you have, enter a width that fits and keep the aspect ratio so the height follows. For a 4:3 picture, 800 pixels wide gives 600 high. Resizing changes the pixels, and an image already smaller than the limit does not need it. Download the result.", toolId: "image-resizer" },
            { heading: "Compress when the byte count is still too high", explanation: "Select the resized file by hand and lower the quality setting. Try a few values, since the saving depends on the picture. A download appears only when the result is actually smaller; otherwise you are told that no smaller file was produced.", toolId: "image-compressor" },
            { heading: "Check the final file against the rule", explanation: "Open the final file's properties, read its format, pixel size and byte count, and compare each with the written rule. If one limit is missed, go back one step with a smaller width or a lower quality instead of changing the rule." },
        ],
        exampleToolId: ["image-resizer", "image-compressor"],
        verification: [
            "The file type is JPEG and its name ends in .jpg or .jpeg.",
            "The width is at most 800 and the height at most 600 pixels, read from the file itself and not from the input fields.",
            "The file is at most 100,000 bytes. A byte count above the limit is a failed check, even if the image looks fine.",
        ],
        limitation: [
            "Lossy encoding can lower visible quality, especially at low quality settings. JPEG also drops transparency.",
            "Resizing changes the pixels permanently, so keep your original. Re-encoding does not always make a file smaller, and a rule may stay unmet.",
            "The tools cannot aim for an exact byte size and cannot promise that any particular upload form will accept the file.",
            "Each image is handled one at a time, up to 25 MiB and 30 megapixels. Metadata is not guaranteed to be preserved.",
        ],
        relatedToolId: ["image-converter", "image-resizer", "image-compressor"],
        reviewedOn: "2026-10-27",
    },
    {
        slug: "heic-photos-to-pdf",
        title: "Turn HEIC Photos into a PDF",
        description: "Convert HEIC or HEIF photos to JPEG or PNG one at a time, then place them in a chosen order in a single PDF and check each page.",
        startingMaterial: "One or more HEIC or HEIF photos, for example from a phone, saved on your device.",
        expectedOutcome: "One PDF with one page per photo, in the order you chose, built from JPEG or PNG files you downloaded in between.",
        step: [
            { heading: "Pick the first HEIC photo and the output format", explanation: "Choose one photo. JPEG is smaller and lossy; PNG is lossless and usually larger. Use the same format for every photo of the set so the pages behave alike.", toolId: "heic-converter" },
            { heading: "Convert it and save the result", explanation: "Run the conversion and use the download button for the converted file. Only one image is processed at a time, so there is no batch and no ZIP file. Rename the file with a number such as 01 so the order stays obvious on your device." },
            { heading: "Repeat for each remaining photo", explanation: "Select the next HEIC photo, convert it with the same format and save it too. Keep every converted file in one folder." },
            { heading: "Select the converted files and order the pages", explanation: "Open the PDF page and choose the JPEG or PNG files yourself. This step does not accept HEIC directly. Use Move up and Move down until the list matches the order you want, create the PDF and download it.", toolId: "images-to-pdf" },
            { heading: "Inspect the PDF before you send it", explanation: "Open the PDF, count the pages and look at each one. If a page is in the wrong place, return to the previous step and reorder; if a photo looks wrong, convert that photo again." },
        ],
        exampleToolId: ["heic-converter", "images-to-pdf"],
        verification: [
            "The PDF has exactly as many pages as you converted photos.",
            "Each page shows the picture you expected, in your intended order and the right way up.",
            "Every page keeps the aspect ratio of its photo, because each page takes the pixel size of its image.",
        ],
        limitation: [
            "A photo can be at most 25 MiB and 30 megapixels. A very large photo may fail to decode or take a long time.",
            "Whether a particular HEIF file can be decoded depends on its content and your browser. Complex or unsupported files may be rejected.",
            "Metadata, color profiles and auxiliary images such as depth maps are not preserved. JPEG conversion is lossy.",
            "There is no text recognition and no bulk HEIC step. The PDF page creation accepts only JPEG and PNG, up to 20 images and 25 MiB together.",
        ],
        relatedToolId: ["heic-converter", "images-to-pdf"],
        reviewedOn: "2026-10-27",
    },
    {
        slug: "pdf-pages-for-slides",
        title: "Prepare PDF Pages for Slides",
        description: "Turn chosen PDF pages into PNG or JPG images at a stated resolution, check page identity, orientation and pixel size, and shrink an image if needed.",
        startingMaterial: "A supported PDF whose pages you can tell apart, such as numbered pages, including pages stored rotated.",
        expectedOutcome: "One image per selected page, in PNG or JPEG, whose pixel size you measured against the size your slide needs.",
        step: [
            { heading: "Choose the pages, the format and the resolution", explanation: "List the pages in the order you want, for example 1,2. Pick PNG for sharp text and graphics or JPG for smaller photographic pages, and pick 72, 150 or 300 DPI. A higher resolution gives more pixels and larger files.", toolId: "pdf-to-image" },
            { heading: "Convert and save each page image", explanation: "Run the conversion and use each page's own download button. A rotated page comes out in its displayed orientation, so a landscape page is a landscape image." },
            { heading: "Open the images and compare them with the PDF", explanation: "Check that each file shows the page you chose, the right way up, with text that you can read at the size it will have on the slide." },
            { heading: "Reduce the pixel size only when the image is too large", explanation: "If an image is bigger than you need, select that saved image by hand, enter a smaller width with the aspect ratio kept, and download the result. Skip this step when the size already fits.", toolId: "image-resizer" },
        ],
        exampleToolId: ["pdf-to-image", "image-resizer"],
        verification: [
            "Each downloaded image shows the page number you asked for, not a neighbouring page.",
            "A page stored rotated has the orientation you see in a PDF viewer.",
            "The image's width and height in pixels, read from the file, match what you need. Do not rely on the number you typed.",
            "Text is readable at the size it will be shown. A larger DPI helps, but legibility is not guaranteed.",
        ],
        limitation: [
            "At most 20 images per run, each downloaded separately. Only 72, 150 and 300 DPI are offered, with a limit of 4096 pixels per side and 16 megapixels per image. The PDF can have up to 100 pages and 10 MiB.",
            "JPEG is lossy and has no transparency. Shrinking an image changes its pixels.",
            "No PowerPoint file is created. There is no cropping of figures, no editable text, no text recognition, no ZIP file and no redaction.",
            "The slide size used here is only an example for checking; your presentation program decides how an image is placed.",
        ],
        relatedToolId: ["pdf-to-image", "image-resizer"],
        reviewedOn: "2026-10-27",
    },
];

function copyOf(guide: TaskGuide): TaskGuide {
    return structuredClone(guide);
}

/** The four authored guides in publication order. Callers receive copies, so mutating one cannot alter the site. */
export function getAllTaskGuide(): TaskGuide[] {
    return TASK_GUIDE.map(copyOf);
}

/** One guide by its URL slug, or undefined for any other slug. */
export function getTaskGuide(slug: string): TaskGuide | undefined {
    const found = TASK_GUIDE.find(guide => guide.slug === slug);
    return found ? copyOf(found) : undefined;
}

/** Guides in which a tool takes part as a step, an example or a related tool, in publication order. */
export function getTaskGuideForTool(toolId: ToolId): TaskGuide[] {
    return TASK_GUIDE.filter(guide =>
        guide.step.some(step => step.toolId === toolId) ||
        guide.exampleToolId.includes(toolId) ||
        guide.relatedToolId.includes(toolId),
    ).map(copyOf);
}
