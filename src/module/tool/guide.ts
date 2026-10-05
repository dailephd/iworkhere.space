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
    "compress-pdf": {
        instruction: ["Choose one PDF.", "Select Compress PDF.", "Wait for local lossless structural optimization and independent verification.", "If the verified result is smaller, download it.", "If no smaller output is produced, keep the original."],
        section: [
            { heading: "What this compression does", text: "QPDF restructures and compresses PDF objects and streams. Pages are not rasterized. This mode is lossless with respect to the supported static-page semantics; image quality is not intentionally reduced. There is one mode: lossless structural compression." },
            { heading: "No reduction is normal", text: "Already optimized PDFs may stay the same size or grow slightly. Download is offered only when independently verified output is actually smaller. NO REDUCTION ACHIEVED is an honest result: the generated replacement is discarded and the original remains the better byte-size choice for this method." },
            { heading: "Supported PDFs and limits", text: "Choose one valid PDF no larger than 10 MiB and with at most 100 pages. Encrypted or password-protected PDFs are unsupported. Malformed PDFs cannot be safely processed; this tool does not offer repair." },
            { heading: "Fidelity boundary", text: `${documentFidelity} Smaller results independently verify page geometry, rotation, extractable text and representative visible content before download. Arbitrary PDF extensions are outside this boundary.` },
            { heading: "Local processing", text: `${documentPrivacy} QPDF WASM runs locally in a short-lived browser worker; document bytes are not uploaded for compression.` },
        ],
        relatedToolId: ["merge-pdf", "split-pdf", "images-to-pdf", "pdf-to-image"],
    },
    "pdf-to-image": {
        instruction: ["Choose one PDF.", "Enter page numbers or ranges such as 1-3 or 3,1.", "Choose PNG or JPG.", "Choose 72, 150 or 300 DPI.", "Adjust quality when JPG is selected.", "Select Convert pages.", "Download each converted page individually after verification."],
        section: [
            { heading: "Page selection", text: "Use a single page (1), an ascending range (1-3), a comma list (1,3,5), or a combination (1-3,6,9-10). Requested sequence is preserved: 3,1 exports page 3 before page 1. Duplicate pages keep their first occurrence. Selection starts at page 1 and supports at most 20 output images. There is no ZIP or automatic download all." },
            { heading: "PNG vs JPG", text: "PNG is the default and uses lossless browser encoding. JPG uses lossy encoding and may be smaller; quality ranges from 0.50 to 1.00, with a default of 0.85. JPG rendering uses an opaque white page background. PNG keeps the accepted PDF.js rendered page appearance without an additional JPG flattening step. WebP output is unsupported." },
            { heading: "Resolution and limits", text: "Choose 72, 150 or 300 DPI; the default is 150 DPI. PDF page rotation is honored. Every selected page is checked before rendering: no output may exceed a 4096-pixel side or a 16 MP canvas. If a page is too large, select a lower DPI. Pages are rendered sequentially to bound memory use." },
            { heading: "PDF source limits", text: "Choose a valid PDF no larger than 10 MiB and with at most 100 pages. Encrypted or password-protected PDFs are unsupported; malformed PDFs cannot be safely processed." },
            { heading: "Local PDF and image processing", text: `${documentPrivacy} Generated page images remain local until you download them. Each image has an individual download link; no previews of all full-size outputs are retained.` },
        ],
        relatedToolId: ["merge-pdf", "split-pdf", "images-to-pdf"],
    },
    "images-to-pdf": {
        instruction: ["Choose 1–20 JPEG/PNG images. You can add more images after the first selection.", "Arrange them with Move up and Move down.", "Select Create PDF.", "Download the resulting PDF after verification."],
        section: [
            { heading: "One image per page", text: "Each image becomes one PDF page in the displayed order. Intrinsic image pixel width and height numerically become PDF points: a 1200 × 800 image creates a 1200 × 800 point page. Aspect ratio is preserved. There are no paper-size, margin, cropping or layout controls; DPI metadata does not change page size." },
            { heading: "Supported images and limits", text: "JPEG and PNG only; WebP and HEIC are unsupported by this tool. Choose up to 20 images, at most 25 MiB together. Each non-empty image also obeys the 25 MiB source limit and 30 megapixels decoded-area limit. Encoded content and successful browser decoding are checked; a rejected selection batch leaves accepted images unchanged." },
            { heading: "Transparency and output caveats", text: "PNG alpha is embedded without an intentional white flattening step. Viewer and page-background presentation may affect how transparency appears. This does not promise a portable transparent PDF page. Metadata preservation is not promised." },
            { heading: "Local image and PDF processing", text: "Images are read locally and the PDF is created in the browser; source images are not uploaded for conversion. The site still loads ordinary application assets and may use separately enabled site observability. Keep the page open until processing and download finish." },
        ],
        relatedToolId: ["merge-pdf", "split-pdf"],
    },
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
