export interface ToolCategoryChoice {
    /** Registered tool id (equal to its slug). category.test.ts proves it resolves to a tool of the same category. */
    toolId: string;
    when: string;
}

export interface ToolCategoryGuidance {
    task: string;
    choice: ToolCategoryChoice[];
    limitation: string;
}

export interface ToolCategoryDefinition {
    id: string;
    title: string;
    description: string;
    guidance: ToolCategoryGuidance;
}

/*
 * Single runtime owner of canonical category identity.
 * Order is the canonical category order; the registry decides which categories
 * are populated. Guidance is authored visitor-facing prose about the tools that
 * the registry currently holds for the category; it never owns tool identity.
 */
export const tool_category_definition_list = [
    {
        id: "document",
        title: "PDF Tools",
        description: "Merge, split, convert and compress PDF files in your browser.",
        guidance: {
            task: "Join, split, convert and shrink PDF files: merge several PDFs into one, split chosen pages into separate PDFs, combine JPEG and PNG images into a PDF, export selected pages as JPG or PNG images, or rewrite a PDF's structure to try to reduce its size.",
            choice: [
                { toolId: "merge-pdf", when: "You have 2 to 10 PDFs to join in a chosen order." },
                { toolId: "split-pdf", when: "You need chosen pages of one PDF as separate PDFs." },
                { toolId: "images-to-pdf", when: "You have JPEG or PNG pictures to place one per page." },
                { toolId: "pdf-to-image", when: "You need selected pages as JPG or PNG images." },
                { toolId: "compress-pdf", when: "You want a smaller file without rasterizing or altering the pages." },
            ],
            limitation: "These are not full PDF editors: they do not edit page content, sign documents or convert Office files. Compress PDF is lossless structural compression, so some PDFs do not get smaller and then no download is offered. Encrypted PDFs are unsupported.",
        },
    },
    {
        id: "text",
        title: "Text Tools",
        description: "Create URL slugs, extract text from HTML, and count words and characters.",
        guidance: {
            task: "Prepare or measure plain text: turn a title into a URL-friendly slug, pull readable text out of HTML markup, or count the words and characters in a passage.",
            choice: [
                { toolId: "slugify", when: "You need a lowercase, hyphenated, ASCII slug for a URL or file name." },
                { toolId: "html-text-extractor", when: "You have HTML source and want its visible text with line breaks kept." },
                { toolId: "word-character-counter", when: "You need word, character, non-whitespace character and line counts." },
            ],
            limitation: "These tools do not translate, summarize or interpret text, and they do not author rich documents. Slugs drop accented and non-Latin characters, and HTML extraction is neither a sanitizer nor a rendering of how a browser displays the page.",
        },
    },
    {
        id: "math",
        title: "Math Tools",
        description: "Evaluate arithmetic expressions with a calculator.",
        guidance: {
            task: "Work out an arithmetic expression made of numbers, + - * / and parentheses.",
            choice: [
                { toolId: "calculator", when: "You want to evaluate a typed expression and see the result." },
            ],
            limitation: "Calculator uses ordinary JavaScript numbers, not arbitrary-precision arithmetic, so it should not be relied on to verify exact mathematical results. It supports only + - * / and parentheses.",
        },
    },
    {
        id: "converter",
        title: "Converters",
        description: "Convert length and weight between units.",
        guidance: {
            task: "Convert a measurement between units of the same kind: a length such as miles to kilometers, or a weight such as pounds to kilograms.",
            choice: [
                { toolId: "length-converter", when: "You have a distance or size in m, km, cm, mm, inches, feet, yards or miles." },
                { toolId: "weight-converter", when: "You have a mass in g, kg, lb or oz." },
            ],
            limitation: "Only length and weight are covered; there is no currency, volume, area or temperature conversion. Results are rounded to at most six decimal places using ordinary numbers and do not establish the accuracy of a measurement.",
        },
    },
    {
        id: "time",
        title: "Time Tools",
        description: "Add and subtract durations written as HH:MM.",
        guidance: {
            task: "Add or subtract durations written as HH:MM, for example to total several spans of time or to work out what remains after taking one away.",
            choice: [
                { toolId: "time-arithmetic", when: "You have two HH:MM values to add together or subtract." },
            ],
            limitation: "Time Arithmetic works on durations only. It does not convert time zones, handle dates or calendars, or show a world clock, and a subtraction that would fall below 00:00 is rejected.",
        },
    },
    {
        id: "image",
        title: "Image Tools",
        description: "Resize, compress and convert images in your browser.",
        guidance: {
            task: "Prepare a picture for sharing or upload: set its pixel dimensions, reduce its file size, switch its format, or turn a HEIC photo into a more widely supported format.",
            choice: [
                { toolId: "image-resizer", when: "You need specific pixel dimensions; the file format stays the same." },
                { toolId: "image-compressor", when: "You want a smaller JPEG, PNG or WebP file." },
                { toolId: "image-converter", when: "You need to switch between JPEG, PNG and WebP." },
                { toolId: "heic-converter", when: "You have a HEIC or HEIF photo and need a JPEG or PNG." },
            ],
            limitation: "Enlarging an image does not recover detail the source never contained, and neither compression nor conversion always produces a smaller file. JPEG cannot keep transparency and lossy formats can shift colors. Each image is limited to 25 MiB and 30 megapixels, and HEIC is converted one image at a time.",
        },
    },
    {
        id: "developer",
        title: "Developer Tools",
        description: "Format and validate JSON, and generate QR codes.",
        guidance: {
            task: "Check or reshape structured data, or turn text into a scannable code: format, minify and validate JSON, or generate a QR code from text or a URL.",
            choice: [
                { toolId: "json-formatter", when: "You have JSON text to pretty-print, minify or check for syntax errors." },
                { toolId: "qr-code-generator", when: "You need a downloadable QR code for a piece of text or a URL." },
            ],
            limitation: "These tools do not run, debug or compile code. The JSON Formatter accepts strict JSON up to 1 MiB, and the QR generator encodes text exactly as entered, up to 2048 bytes, without checking that a URL works.",
        },
    },
] as const satisfies readonly ToolCategoryDefinition[];

export type ToolCategory = (typeof tool_category_definition_list)[number]["id"];

export function isToolCategory(value: string): value is ToolCategory {
    return tool_category_definition_list.some((definition) => definition.id === value);
}

export function getToolCategoryDefinition(category: ToolCategory): ToolCategoryDefinition {
    const definition = tool_category_definition_list.find((one) => one.id === category);
    if (!definition) {
        throw new Error(`Unknown tool category: ${category}`);
    }
    return definition;
}

export function getToolCategoryLabel(category: ToolCategory): string {
    const definition = getToolCategoryDefinition(category);
    return category === "converter" ? definition.title : category[0].toUpperCase() + category.slice(1);
}
