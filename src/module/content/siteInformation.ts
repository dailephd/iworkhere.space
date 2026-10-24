import { getAllTool, getAvailableCategory } from "@/module/tool/metadata";

export interface SitePublisher {
    legalName: string;
    productName: string;
}

export interface SiteCapability {
    id: string;
    title: string;
    body: string;
}

export interface SiteRelease {
    version: string;
    date: string;
    title: string;
}

export interface SiteContactInformation {
    purpose: string;
    reportDistinction: string;
}

export interface SiteInformation {
    publisher: SitePublisher;
    purpose: string;
    toolCount: number;
    categoryCount: number;
    capability: SiteCapability[];
    maintenance: string[];
    limitation: string[];
    release: SiteRelease[];
    contact: SiteContactInformation;
}

/*
 * Publisher and trust-page copy for /about and /contact. Every statement is grounded in the repository:
 * the publisher name is the footer identity, the processing statement is the released privacy policy,
 * the release list is the published CHANGELOG headings, and the counts come from the tool registry.
 * It deliberately holds no address, phone number, biography, staffing, testimonial or response-time claim,
 * and never the operator inbox.
 */
export function getSiteInformation(): SiteInformation {
    return {
        publisher: { legalName: "dailephd LLC", productName: "iworkhere.space" },
        purpose: "iworkhere.space is a collection of small browser tools for PDF, image, text, calculation, unit conversion, time and developer tasks, published by dailephd LLC. Each tool has its own page that says what it does and where it stops.",
        toolCount: getAllTool().length,
        categoryCount: getAvailableCategory().length,
        capability: [
            { id: "pdf", title: "PDF and documents", body: "Merge PDFs, split chosen pages into separate PDFs, compress a PDF, combine JPEG and PNG images into a PDF, and export PDF pages as JPG or PNG images." },
            { id: "image", title: "Images", body: "Resize and compress images, and convert between JPG, PNG and WebP or from HEIC to JPG or PNG." },
            { id: "text", title: "Text", body: "Create URL slugs, extract readable text from HTML, and count words and characters." },
            { id: "calculation", title: "Calculation, conversion and time", body: "Evaluate arithmetic expressions, convert lengths and weights, and add or subtract durations written as hours and minutes." },
            { id: "developer", title: "Developer tasks", body: "Format and validate JSON, and generate QR codes." },
        ],
        maintenance: [
            "The PDF, image, text, JSON and QR code tools process your files and text in your browser. They are not uploaded to our servers.",
            "Every change passes type checking, linting, unit tests, browser tests and a production-container check before it is released.",
            "Site measurements and diagnostics exclude tool inputs, files and results. The Privacy Policy describes what is collected and why.",
        ],
        limitation: [
            "These are single-purpose utilities, not full editors. For example, the PDF tools do not edit page content or sign documents, and Compress PDF cannot make every file smaller.",
            "Files are processed on your device, so large files depend on your browser and available memory, and each tool enforces size limits.",
            "Check results before you rely on them. A tool may not suit every document or input.",
            "Contact Us sends a message to the site operator by email. We do not promise a reply by a particular time.",
        ],
        release: [
            { version: "v0.4.2", date: "2026-10-20", title: "User Reporting & Retractable Site Chrome" },
            { version: "v0.4.1", date: "2026-10-11", title: "UI and Converter updates" },
            { version: "v0.4.0", date: "2026-10-08", title: "Core Text, Data & Sharing Utilities" },
            { version: "v0.3.1", date: "2026-10-06", title: "Vercel Web Analytics" },
            { version: "v0.3.0", date: "2026-10-06", title: "PDF & Document Essentials" },
        ],
        contact: {
            purpose: "Use Contact Us for general questions or comments about iworkhere.space. The email address, title and message you enter are sent by email to the site operator through Resend so that a reply is possible.",
            reportDistinction: "To report a problem with a specific tool or suggest an improvement, use the Report Issues control in the footer when it is shown. Reports are a separate system with their own handling, and the contact form does not create a report.",
        },
    };
}
