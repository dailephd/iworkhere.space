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

export const tool_definition_list: ToolDefinition[] = [
    {
        id: "merge-pdf", slug: "merge-pdf", name: "Merge PDF",
        description: "Merge multiple PDF files into one PDF locally in your browser.",
        category: "document",
        seo: { title: "Merge PDF Files", description: "Merge 2 to 10 PDF files into one PDF locally in your browser.", canonicalPath: "/tool/merge-pdf" },
        capability: ["client-only", "offline"],
        tag: ["pdf", "document", "merge", "combine", "utility"],
        statePolicy: { persist: "none", shareableQuery: false },
        Component: MergePdfTool,
    },
    {
        id: "split-pdf", slug: "split-pdf", name: "Split PDF",
        description: "Split selected pages from a PDF into separate PDF files locally in your browser.",
        category: "document",
        seo: { title: "Split PDF Pages", description: "Split a PDF into up to 20 page groups locally in your browser.", canonicalPath: "/tool/split-pdf" },
        capability: ["client-only", "offline"],
        tag: ["pdf", "document", "split", "pages", "utility"],
        statePolicy: { persist: "none", shareableQuery: false },
        Component: SplitPdfTool,
    },
    {
        id: "images-to-pdf", slug: "images-to-pdf", name: "Images to PDF",
        description: "Combine JPEG and PNG images into one PDF locally in your browser.",
        category: "document",
        seo: { title: "Images to PDF", description: "Combine up to 20 JPEG and PNG images into one PDF locally in your browser.", canonicalPath: "/tool/images-to-pdf" },
        capability: ["client-only", "offline"],
        tag: ["pdf", "document", "image", "jpg", "jpeg", "png", "convert", "utility"],
        statePolicy: { persist: "none", shareableQuery: false },
        Component: ImagesToPdfTool,
    },
    {
        id: "slugify",
        slug: "slugify",
        name: "Slugify Text",
        description: "Convert text into URL-safe slugs.",
        category: "text",
        seo: {
            title: "Slugify Text",
            description: "Free slug generator",
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
        description: "Evaluate simple math expressions.",
        category: "math",
        seo: {
            title: "Calculator",
            description: "Free calculator for quick math.",
            canonicalPath: "/tool/calculator",
        },
        capability: ["client-only", "offline"],
        tag: ["math", "utility"],
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
        description: "Convert between common length units.",
        category: "everyday",
        seo: {
            title: "Length Converter",
            description: "Free length unit converter",
            canonicalPath: "/tool/length-converter",
        },
        capability: ["client-only", "offline"],
        tag: ["unit-converter", "everyday"],
        popularity: 15,
        Component: LengthConverterTool,
    },

    {
        id: "html-text-extractor",
        slug: "html-text-extractor",
        name: "HTML Text Extractor",
        description: "Extract visible text from HTML and preserve line breaks.",
        category: "text",
        seo: {
            title: "HTML Text Extractor",
            description: "Free online tool to extract visible text from HTML with preserved line breaks.",
            canonicalPath: "/tool/html-text-extractor",
        },
        capability: ["client-only", "offline"],
        tag: ["text", "html", "utility"],
        popularity: 14,
        Component: HtmlTextExtractorTool,
    },

    {
        id: "weight-converter",
        slug: "weight-converter",
        name: "Weight Converter",
        description: "Convert between common weight units.",
        category: "everyday",
        seo: {
            title: "Weight Converter",
            description: "Free weight unit converter",
            canonicalPath: "/tool/weight-converter",
        },
        capability: ["client-only", "offline"],
        tag: ["unit-converter", "everyday"],
        popularity: 12,
        Component: WeightConverterTool,
    },

    {
        id: "time-arithmetic",
        slug: "time-arithmetic",
        name: "Time Arithmetic",
        description: "Add and subtract time values in HH:MM format.",
        category: "time",
        seo: {
            title: "Time Arithmetic",
            description: "Free online tool to add and subtract time values with carry and borrow normalization.",
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
        description: "Resize JPEG, PNG, and WebP images locally in your browser.",
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
        description: "Compress JPEG, PNG, and WebP images locally in your browser.",
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
        description: "Convert JPEG, PNG, and WebP images locally in your browser.",
        category: "image",
        seo: {
            title: "JPG / PNG / WebP Converter",
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
        description: "Convert HEIC and HEIF images to JPEG or PNG locally in your browser.",
        category: "image",
        seo: {
            title: "HEIC to JPG / PNG Converter",
            description: "Convert HEIC and HEIF images to JPEG or PNG locally in your browser.",
            canonicalPath: "/tool/heic-converter",
        },
        capability: ["client-only", "offline"],
        tag: ["image", "converter", "heic", "heif", "jpg", "png"],
        statePolicy: { persist: "none", shareableQuery: false },
        Component: HeicConverterTool,
    },
];

export function getToolBySlug(slug: string) {
    return tool_definition_list.find(t => t.slug === slug);
}

export function getToolByCategory(category: string) {
    return tool_definition_list.filter(t => t.category === category);
}
