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

const guideById: Partial<Record<ToolId, ToolGuide>> = {
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
