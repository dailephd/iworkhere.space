import type { ToolDefinition } from "./type";
import { SlugifyTool } from "./text/SlugifyTool";
import { HtmlTextExtractorTool } from "./text/HtmlTextExtractorTool";
import { CalculatorTool } from "@/module/tool/math/CalculatorTool";
import { LengthConverterTool } from "./everyday/LengthConverterTool";
import { WeightConverterTool } from "./everyday/WeightConverterTool";
import { TimeArithmeticTool } from "./time/TimeArithmeticTool";
import { ImageResizerTool } from "./image/ImageResizerTool";
import { ImageCompressorTool } from "./image/ImageCompressorTool";
import { ImageConverterTool } from "./image/ImageConverterTool";
import { HeicConverterTool } from "./image/HeicConverterTool";
import { MergePdfTool } from "./document/MergePdfTool";
import { SplitPdfTool } from "./document/SplitPdfTool";
import { ImagesToPdfTool } from "./document/ImagesToPdfTool";
import { PdfToImageTool } from "./document/PdfToImageTool";
import { CompressPdfTool } from "./document/CompressPdfTool";
import { JsonFormatterTool } from "./developer/JsonFormatterTool";
import { WordCharacterCounterTool } from "./text/WordCharacterCounterTool";
import { QrCodeGeneratorTool } from "./everyday/QrCodeGeneratorTool";

export const tool_definition_list: ToolDefinition[] = [
    {
        id: "merge-pdf", slug: "merge-pdf", name: "Merge PDF",
        description: "Combine several PDF files into one PDF, in the order you choose.",
        category: "document",
        seo: { title: "Merge PDF Files Online", description: "Merge 2 to 10 PDF files into one PDF locally in your browser.", canonicalPath: "/tool/merge-pdf" },
        capability: ["client-only", "offline"],
        tag: ["pdf", "document", "merge", "combine", "utility"],
        statePolicy: { persist: "none", shareableQuery: false },
        Component: MergePdfTool,
    },
    {
        id: "split-pdf", slug: "split-pdf", name: "Split PDF",
        description: "Turn page ranges from one PDF into separate PDF files.",
        category: "document",
        seo: { title: "Split PDF Pages Online", description: "Split a PDF into up to 20 page groups locally in your browser.", canonicalPath: "/tool/split-pdf" },
        capability: ["client-only", "offline"],
        tag: ["pdf", "document", "split", "pages", "utility"],
        statePolicy: { persist: "none", shareableQuery: false },
        Component: SplitPdfTool,
    },
    {
        id: "images-to-pdf", slug: "images-to-pdf", name: "Images to PDF",
        description: "Turn JPEG and PNG images into one PDF, one image per page.",
        category: "document",
        seo: { title: "Images to PDF Converter", description: "Combine up to 20 JPEG and PNG images into one PDF locally in your browser.", canonicalPath: "/tool/images-to-pdf" },
        capability: ["client-only", "offline"],
        tag: ["pdf", "document", "image", "jpg", "jpeg", "png", "convert", "utility"],
        statePolicy: { persist: "none", shareableQuery: false },
        Component: ImagesToPdfTool,
    },
    {
        id: "pdf-to-image", slug: "pdf-to-image", name: "PDF to JPG / PNG",
        description: "Turn selected PDF pages into JPG or PNG images.",
        category: "document",
        seo: { title: "PDF to JPG and PNG Converter", description: "Convert selected PDF pages to JPG or PNG images locally in your browser.", canonicalPath: "/tool/pdf-to-image" },
        capability: ["client-only", "offline"],
        tag: ["pdf", "document", "image", "jpg", "jpeg", "png", "convert", "utility"],
        statePolicy: { persist: "none", shareableQuery: false },
        Component: PdfToImageTool,
    },
    {
        id: "compress-pdf", slug: "compress-pdf", name: "Compress PDF",
        description: "Reduce a PDF's size by restructuring it, without rasterizing pages.",
        category: "document",
        seo: { title: "Compress PDF Files Online", description: "Compress PDF structure locally in your browser with lossless QPDF optimization.", canonicalPath: "/tool/compress-pdf" },
        capability: ["client-only", "offline"],
        tag: ["pdf", "document", "compress", "optimize", "utility"],
        statePolicy: { persist: "none", shareableQuery: false },
        Component: CompressPdfTool,
    },
    {
        id: "slugify",
        slug: "slugify",
        name: "Slugify Text",
        description: "Turn a title or phrase into a lowercase, hyphenated URL slug.",
        category: "text",
        seo: {
            title: "Slug Generator",
            description: "Turn a title or phrase into a lowercase, hyphenated URL slug in your browser.",
            canonicalPath: "/tool/slugify",
        },
        capability: ["client-only", "offline"],
        tag: ["text", "utility"],
        popularity: 10,
        Component: SlugifyTool,
    },

    {
        id: "calculator",
        slug: "calculator",
        name: "Calculator",
        description: "Evaluate an arithmetic expression with + - * / and parentheses.",
        category: "math",
        seo: {
            title: "Online Calculator",
            description: "Evaluate arithmetic with + - * / and parentheses in your browser. Uses ordinary JavaScript numbers.",
            canonicalPath: "/tool/calculator",
        },
        capability: ["client-only", "offline"],
        tag: ["math", "calculate", "utility"],
        popularity: 20,
        statePolicy: {
            persist: "none",
            shareableQuery: true,
            defaultQuery: {
                expr: "",
            },
        },
        Component: CalculatorTool,
    },

    {
        id: "length-converter",
        slug: "length-converter",
        name: "Length Converter",
        description: "Convert a length between units such as meters, feet and miles.",
        category: "converter",
        seo: {
            title: "Length Converter",
            description: "Convert between meters, kilometers, centimeters, millimeters, inches, feet, yards and miles.",
            canonicalPath: "/tool/length-converter",
        },
        capability: ["client-only", "offline"],
        tag: ["unit-converter", "converter"],
        popularity: 15,
        Component: LengthConverterTool,
    },

    {
        id: "html-text-extractor",
        slug: "html-text-extractor",
        name: "HTML Text Extractor",
        description: "Extract plain text from pasted HTML, keeping its line breaks.",
        category: "text",
        seo: {
            title: "HTML to Text Converter",
            description: "Extract the visible text from pasted HTML and keep its line breaks.",
            canonicalPath: "/tool/html-text-extractor",
        },
        capability: ["client-only", "offline"],
        tag: ["text", "html", "extract", "utility"],
        popularity: 14,
        Component: HtmlTextExtractorTool,
    },

    {
        id: "weight-converter",
        slug: "weight-converter",
        name: "Weight Converter",
        description: "Convert a mass between grams, kilograms, pounds and ounces.",
        category: "converter",
        seo: {
            title: "Weight Converter",
            description: "Convert between grams, kilograms, pounds and ounces.",
            canonicalPath: "/tool/weight-converter",
        },
        capability: ["client-only", "offline"],
        tag: ["unit-converter", "converter"],
        popularity: 12,
        Component: WeightConverterTool,
    },

    {
        id: "time-arithmetic",
        slug: "time-arithmetic",
        name: "Time Arithmetic",
        description: "Add or subtract two HH:MM durations to get a new duration.",
        category: "time",
        seo: {
            title: "Add and Subtract Time",
            description: "Add or subtract two HH:MM durations. A subtraction that would go below 00:00 is rejected.",
            canonicalPath: "/tool/time-arithmetic",
        },
        capability: ["client-only", "offline"],
        tag: ["time", "utility"],
        popularity: 11,
        statePolicy: {
            persist: "none",
            shareableQuery: false,
        },
        Component: TimeArithmeticTool,
    },
    {
        id: "image-resizer",
        slug: "image-resizer",
        name: "Image Resizer",
        description: "Change the pixel width and height of a JPEG, PNG or WebP image.",
        category: "image",
        seo: {
            title: "Image Resizer",
            description: "Resize JPEG, PNG, and WebP images locally in your browser.",
            canonicalPath: "/tool/image-resizer",
        },
        capability: ["client-only", "offline"],
        tag: ["image", "resize", "utility"],
        statePolicy: { persist: "none", shareableQuery: false },
        Component: ImageResizerTool,
    },
    {
        id: "image-compressor",
        slug: "image-compressor",
        name: "Image Compressor",
        description: "Reduce the file size of a JPEG, PNG or WebP image.",
        category: "image",
        seo: {
            title: "Image Compressor",
            description: "Compress JPEG, PNG, and WebP images locally in your browser.",
            canonicalPath: "/tool/image-compressor",
        },
        capability: ["client-only", "offline"],
        tag: ["image", "compress", "utility"],
        statePolicy: { persist: "none", shareableQuery: false },
        Component: ImageCompressorTool,
    },
    {
        id: "image-converter",
        slug: "image-converter",
        name: "JPG / PNG / WebP Converter",
        description: "Convert an image between JPEG, PNG and WebP.",
        category: "image",
        seo: {
            title: "JPG, PNG and WebP Converter",
            description: "Convert JPEG, PNG, and WebP images locally in your browser.",
            canonicalPath: "/tool/image-converter",
        },
        capability: ["client-only", "offline"],
        tag: ["image", "converter", "jpg", "png", "webp"],
        statePolicy: { persist: "none", shareableQuery: false },
        Component: ImageConverterTool,
    },
    {
        id: "heic-converter",
        slug: "heic-converter",
        name: "HEIC → JPG / PNG Converter",
        description: "Turn a HEIC or HEIF photo into a JPEG or PNG image.",
        category: "image",
        seo: {
            title: "HEIC to JPG and PNG Converter",
            description: "Convert HEIC and HEIF images to JPEG or PNG locally in your browser.",
            canonicalPath: "/tool/heic-converter",
        },
        capability: ["client-only", "offline"],
        tag: ["image", "converter", "heic", "heif", "jpg", "png"],
        statePolicy: { persist: "none", shareableQuery: false },
        Component: HeicConverterTool,
    },
    {
        id: "json-formatter",
        slug: "json-formatter",
        name: "JSON Formatter / Validator",
        description: "Format, minify or validate strict JSON text.",
        category: "developer",
        seo: {
            title: "JSON Formatter and Validator",
            description: "Format, minify, and validate strict JSON locally in your browser without uploading your data.",
            canonicalPath: "/tool/json-formatter",
        },
        capability: ["client-only", "offline"],
        tag: ["json", "developer", "format", "validate", "minify", "utility"],
        statePolicy: { persist: "none", shareableQuery: false },
        Component: JsonFormatterTool,
    },
    {
        id: "word-character-counter",
        slug: "word-character-counter",
        name: "Word / Character Counter",
        description: "Count words, characters, characters without whitespace and lines in text.",
        category: "text",
        seo: {
            title: "Word and Character Counter",
            description: "Count words, Unicode characters, characters excluding whitespace, and lines locally in your browser.",
            canonicalPath: "/tool/word-character-counter",
        },
        capability: ["client-only", "offline"],
        tag: ["text", "word", "character", "counter", "utility"],
        statePolicy: { persist: "none", shareableQuery: false },
        Component: WordCharacterCounterTool,
    },
    {
        id: "qr-code-generator",
        slug: "qr-code-generator",
        name: "QR Code Generator",
        description: "Turn text or a URL into a downloadable QR code PNG.",
        category: "developer",
        seo: {
            title: "QR Code Generator",
            description: "Generate a QR code from text or a URL locally in your browser and download it as a PNG.",
            canonicalPath: "/tool/qr-code-generator",
        },
        capability: ["client-only", "offline"],
        tag: ["qr", "code", "generator", "url", "developer", "utility"],
        statePolicy: { persist: "none", shareableQuery: false },
        Component: QrCodeGeneratorTool,
    },
];

export function getToolBySlug(slug: string) {
    return tool_definition_list.find(t => t.slug === slug);
}

export function getToolByCategory(category: string) {
    return tool_definition_list.filter(t => t.category === category);
}
