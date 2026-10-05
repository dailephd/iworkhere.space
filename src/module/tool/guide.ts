import type { ToolId } from "./type";

export interface ToolGuideSection {
    heading: string;
    text: string;
}

export interface ToolGuide {
    instruction: string[];
    section: ToolGuideSection[];
    relatedToolId: ToolId[];
}

const privacy = "Image processing happens locally in this browser; your image is not uploaded for processing. The site still loads ordinary application assets and may use separately enabled site observability. Keep the page open until processing and download finish.";
const documentPrivacy = "PDF processing happens locally in the browser; your PDF is not uploaded for processing. The site still loads ordinary application assets and may use separately enabled site observability. Keep the page open until processing and download finish.";
const documentFidelity = "The supported boundary is static pages: page order, dimensions, rotation, visible content and extractable text. Preservation of metadata, bookmarks, attachments, complex interactive forms, accessibility structure and digital signatures or their cryptographic validity is not guaranteed.";

const guideById: Partial<Record<ToolId, ToolGuide>> = {
    "merge-pdf": {
        instruction: ["Choose 2–10 PDFs. You can add more PDFs after the first selection.", "Arrange the documents with Move up and Move down. Each document's pages keep their original order.", "Select Merge PDF.", "Review the verified page count and size, then download the merged file."],
        section: [
            { heading: "Document and page order", text: "Documents are joined in the displayed order, with all pages from the first PDF followed by all pages from the next PDF. Selecting the same local file twice intentionally includes it twice. This tool does not compress the documents." },
            { heading: "PDF limits and unsupported sources", text: "Choose 2–10 PDFs, each no larger than 10 MiB. Together they must be at most 25 MiB and 100 pages. A rejected selection batch leaves your accepted list unchanged. Encrypted or password-protected PDFs are unsupported; malformed PDFs cannot be safely processed." },
            { heading: "Static-page fidelity", text: documentFidelity },
            { heading: "Local PDF processing", text: documentPrivacy },
        ],
        relatedToolId: ["split-pdf"],
    },
    "split-pdf": {
        instruction: ["Choose one PDF.", "Define page groups such as 1-3 or 4,6.", "Add or remove output groups as needed.", "Select Split PDF.", "Download the generated PDFs individually after verification."],
        section: [
            { heading: "Page groups and syntax", text: "Use a single page (1), an ascending range (1-3), a comma list (1,3,5), or a combination (1-3,6,9-10). Requested sequence is kept, so 3,1 puts page 3 before page 1. Within one group the first occurrence of a page is retained; separate groups may overlap. Up to 20 output groups are supported." },
            { heading: "PDF limits and individual downloads", text: "The source must be no larger than 10 MiB and have at most 100 pages. Encrypted or password-protected PDFs are unsupported; malformed PDFs cannot be safely processed. Each group produces a separate PDF in group order. There is no ZIP output or automatic bulk download." },
            { heading: "Static-page fidelity", text: documentFidelity },
            { heading: "Local PDF processing", text: documentPrivacy },
        ],
        relatedToolId: ["merge-pdf"],
    },
    "image-resizer": {
        instruction: ["Choose a JPEG, PNG or WebP image.", "Enter the desired width or height. Keep Preserve aspect ratio selected to avoid stretching.", "Select Resize image, review the dimensions, then download the result."],
        section: [
            { heading: "Change dimensions, keep the format", text: "Resizing changes pixel dimensions, not the file format. For example, an 800 × 600 image becomes 400 × 300 when you halve its width with aspect ratio preserved. Upscaling cannot recreate detail missing from the source." },
            { heading: "Supported images and limits", text: "JPEG, PNG and WebP inputs produce the same output format. Source files must be non-empty and no larger than 25 MiB, with at most 30 megapixels. The requested output must also stay within the tool's pixel limits." },
            { heading: "Local processing and caveats", text: `${privacy} Browser re-encoding may change file size. Metadata preservation is not guaranteed.` },
        ],
        relatedToolId: ["image-compressor", "image-converter", "heic-converter"],
    },
    "image-compressor": {
        instruction: ["Choose a JPEG, PNG or WebP image.", "For JPEG or WebP, choose Quality; PNG uses lossless browser re-encoding.", "Select Compress image and compare the byte counts. Download is offered only when the result is smaller."],
        section: [
            { heading: "Reduce bytes without resizing", text: "Compression keeps the source dimensions and format. Lower JPEG or WebP quality can reduce bytes at the cost of visible detail. There is no target-file-size control, and the tool processes one image at a time." },
            { heading: "Supported images and limits", text: "Inputs and outputs are JPEG, PNG or WebP. Non-empty source files are limited to 25 MiB and 30 megapixels. PNG has no quality slider; native lossless re-encoding does not reduce every file. A larger candidate is reported honestly and is not offered as a compressed download." },
            { heading: "Local processing and caveats", text: `${privacy} Metadata preservation is not guaranteed. File size and quality depend on the source and the browser encoder.` },
        ],
        relatedToolId: ["image-resizer", "image-converter", "heic-converter"],
    },
    "image-converter": {
        instruction: ["Choose a JPEG, PNG or WebP source.", "Choose a different output format. Adjust Quality when JPEG or WebP is selected.", "Select Convert image, check the output format and byte count, then download."],
        section: [
            { heading: "Choose a format for the destination", text: "Conversion keeps the original pixel dimensions. PNG supports transparency and uses lossless encoding; JPEG has no transparency, so transparent pixels receive a white background. WebP also supports transparency and uses the browser's quality setting." },
            { heading: "Supported images and limits", text: "Convert between JPEG, PNG and WebP, with only formats different from the source offered. Source files must be non-empty and at most 25 MiB and 30 megapixels. PNG has no lossy-quality control. Conversion is not a guarantee of a smaller file." },
            { heading: "Local processing and caveats", text: `${privacy} Metadata preservation is not guaranteed, and lossy outputs may change visual detail.` },
        ],
        relatedToolId: ["image-resizer", "image-compressor", "heic-converter"],
    },
    "heic-converter": {
        instruction: ["Choose a supported HEIC or HEIF image and wait for its decoded preview.", "Choose JPEG or PNG. JPEG offers Quality and uses a white background for transparent pixels.", "Select Convert image, review the output dimensions and size, then download."],
        section: [
            { heading: "Make a HEIC image easier to use", text: "The local decoder runs in a short-lived browser worker. Conversion creates JPEG or PNG at the decoded source dimensions. JPEG is useful for ordinary photo destinations; PNG avoids the JPEG quality control, but can be substantially larger." },
            { heading: "Supported images and limits", text: "Supported HEIC and HEIF inputs must be non-empty, no larger than 25 MiB, and no larger than 30 megapixels. Outputs are JPEG or PNG only. Complex or unsupported HEIF content may fail to decode; this is a single-image workflow, not a bulk converter." },
            { heading: "Local processing and caveats", text: `${privacy} Metadata, color-profile and auxiliary-image preservation are not guaranteed. There is no universal HEIC transparency-preservation guarantee. Reset or replacing the source cancels the active worker.` },
        ],
        relatedToolId: ["image-converter", "image-resizer", "image-compressor"],
    },
};

export function getToolGuide(toolId: ToolId): ToolGuide | undefined {
    return Object.hasOwn(guideById, toolId) ? guideById[toolId] : undefined;
}
