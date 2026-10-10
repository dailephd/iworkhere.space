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
    "slugify": {
        instruction: ["Enter text in the Text input.", "Read the generated slug below the input; it updates as you type.", "Edit the input if the result needs different wording."],
        section: [
            { heading: "Turn a title into a slug", text: "A slug is a short text identifier often used in a URL path. Uppercase English letters become lowercase. Runs of spaces, punctuation and other characters outside a–z and 0–9 become one hyphen; leading and trailing hyphens are removed. Hello World! becomes hello-world, and Ready... Set / Go! becomes ready-set-go." },
            { heading: "ASCII handling and empty results", text: "This tool does not transliterate accented or non-Latin characters into Latin equivalents. For example, Café 東京 becomes caf. Empty input or unsupported-only input such as 東京 or !!! produces an empty slug. Edit the input to use the English spelling you want when necessary." },
            { heading: "Check the destination", text: "The result is a text suggestion, not a uniqueness check. Different titles can produce the same slug; check existing names and the destination's URL rules before using it." },
        ],
        relatedToolId: ["html-text-extractor", "word-character-counter"],
    },
    "length-converter": {
        instruction: ["Enter a number in Value.", "Choose the input unit in From and the desired output unit in To.", "Read Result with its destination-unit abbreviation; changing the value or either unit updates it immediately."],
        section: [
            { heading: "Convert a length", text: "Use this tool to express the same length in another unit. From describes the value you entered; To describes the result. For example, Value 1 with From Meters (m) and To Feet (ft) displays 3.28084 ft. Switching To to Centimeters (cm) displays 100 cm." },
            { heading: "Supported length units", text: "Choose meters (m), kilometers (km), centimeters (cm), millimeters (mm), inches (inch), feet (ft), yards (yd) or miles (mile). Conversion goes through meters; an inch is 0.0254 meters and a mile is 1609.344 meters. Other length units and area or volume conversions are not available." },
            { heading: "Rounding and numeric input", text: "Results are rounded to at most six decimal places, with trailing zeros removed. Very small results can round to zero. The calculation uses ordinary JavaScript numbers, not arbitrary-precision arithmetic; displayed decimals do not guarantee measurement accuracy. A blank value or a value that cannot be parsed as a number displays Invalid input. Enter a finite numeric value and check the selected units." },
        ],
        relatedToolId: ["weight-converter", "calculator"],
    },
    "weight-converter": {
        instruction: ["Enter a number in Value.", "Choose the input unit in From and the desired output unit in To.", "Read Result with its destination-unit abbreviation; it updates when the value or either unit changes."],
        section: [
            { heading: "Convert a mass", text: "Although named Weight Converter, this tool converts mass units rather than physical force. From is the unit of the value you enter; To is the unit of the result. Value 1 with From Kilograms (kg) and To Pounds (lb) displays 2.204623 lb. Switching To to Grams (g) displays 1000 g." },
            { heading: "Supported mass units", text: "Choose grams (g), kilograms (kg), pounds (lb) or ounces (oz). Conversion goes through grams, using 453.59237 grams per pound and 28.349523125 grams per ounce. These are ordinary avoirdupois pounds and ounces, not troy units or fluid ounces. No other units or force conversions are offered." },
            { heading: "Rounding and numeric input", text: "Results are rounded to at most six decimal places and trailing zeros are removed. Very small results can round to zero. Ordinary JavaScript numbers have finite precision; this display does not provide arbitrary precision or establish the accuracy of a measurement. A blank value or a value that cannot be parsed as a number displays Invalid input. Enter a finite numeric value and check the selected units." },
        ],
        relatedToolId: ["length-converter", "calculator"],
    },
    "html-text-extractor": {
        instruction: ["Paste HTML into HTML Input.", "Select Convert to extract text.", "Review Extracted Text; after editing the HTML, select Convert again to update it.", "Select Copy to copy a non-empty result. If clipboard access fails, select and copy the text manually."],
        section: [
            { heading: "Extract text from HTML", text: "The tool parses supplied HTML with DOMParser and collects text nodes from the resulting body. For example, <p>Hello <strong>world</strong><br>Next line</p><script>ignored()</script> produces Hello world followed by a line break and Next line. Script and style subtrees are excluded." },
            { heading: "Line breaks and whitespace", text: "A br element inserts a line break. Selected structural elements, including paragraphs, headings, list items and table cells, add a break after their contents. Runs of spaces and tabs within text nodes are reduced to one space, trailing whitespace on each line is removed, three or more consecutive line breaks become two, and the final result is trimmed. Empty HTML produces empty text." },
            { heading: "Extraction limits", text: "This is DOM-based extraction, not full browser visual-text rendering. CSS computed visibility is not checked, so text hidden with CSS may still appear. Browser layout, generated CSS content and image descriptions are not reproduced. This is not an HTML sanitizer and does not make markup safe for subsequent HTML rendering. Review the extracted text before reusing it." },
        ],
        relatedToolId: ["word-character-counter", "slugify"],
    },
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
        relatedToolId: ["merge-pdf", "split-pdf", "pdf-to-image"],
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
    "json-formatter": {
        instruction: ["Paste JSON into the input.", "Select Format JSON for 2-space indentation or Minify JSON to remove whitespace.", "Review the output, or read the validation error and its line and column.", "Select Copy result to copy a valid result."],
        section: [
            { heading: "Strict JSON", text: "Input must be strict JSON as defined by RFC 8259. Any value is accepted as the root: an object, array, string, number, true, false or null. Comments, trailing commas, single-quoted strings, unquoted property names, NaN, Infinity, leading-zero numbers and extra content after the value are rejected with an error that names the problem and its position." },
            { heading: "Token-preserving formatting", text: "Formatting and minifying change only insignificant whitespace. Numbers, string escape spelling, true/false/null, member order and duplicate member names are copied exactly as written. Nothing is converted to a JavaScript value first, so very large integers, exponent notation, -0 and escaped Unicode are not coerced, normalized, collapsed or reordered." },
            { heading: "Size limit", text: "Input is limited to 1 MiB of UTF-8. Larger input is rejected before it is checked. Pretty-printing extremely deeply nested JSON can produce very large output; if that would happen the tool stops with an explanation, and Minify still works." },
            { heading: "Local processing", text: "JSON is processed locally in this browser and is not uploaded for formatting or validation. The site still loads ordinary application assets and may use separately enabled site observability, which never receives your JSON." },
        ],
        relatedToolId: ["html-text-extractor", "slugify"],
    },
    "word-character-counter": {
        instruction: ["Enter or paste text into the Text box.", "Review the four live counts: Words, Characters, Characters excluding whitespace and Lines.", "Edit the text as needed; the counts update as you type.", "Select Reset to clear the text and return every count to zero."],
        section: [
            { heading: "Word counting", text: "A word is a run of Unicode letters and numbers. Combining marks stay with the run they follow, and a single straight (') or curly (’) apostrophe between two runs joins them, so don't and don’t are one word. Punctuation around a word is not counted. Hyphens, underscores and slashes separate words, so well-known counts as two words. The rule does not depend on the language or locale, and a continuous run of Chinese, Japanese or Korean characters counts as one word." },
            { heading: "Character counting", text: "Characters are Unicode grapheme clusters, the units a reader sees as one character. An accented letter written with a combining accent, an emoji with a skin tone, an emoji sequence joined by zero-width joiners and a flag each count once. This needs the browser's built-in Intl.Segmenter support; without it the tool says so instead of showing an approximate count." },
            { heading: "Whitespace and lines", text: "Characters excluding whitespace removes characters with the Unicode White_Space property, including spaces, tabs, line breaks, non-breaking spaces and ideographic spaces. A zero-width space (U+200B) is not White_Space and is counted. Lines are separated by CRLF, CR or LF only: empty text has zero lines, any other text has one more line than it has separators, so a trailing line break starts another line. Unicode NEL, line separator and paragraph separator characters do not start a new line." },
            { heading: "Limits and local processing", text: "Text is limited to 1 MiB of UTF-8; larger text is not counted and is not truncated. Counting happens locally in this browser. Your text is not uploaded, saved or placed in the page address. The site still loads ordinary application assets and may use separately enabled site observability, which never receives your text." },
        ],
        relatedToolId: ["slugify", "html-text-extractor"],
    },
    "qr-code-generator": {
        instruction: ["Enter text or a URL in the Text or URL box.", "Select Generate QR code.", "Scan or review the preview.", "Select Download PNG to save the image if needed.", "Select Reset to clear the text and the QR code."],
        section: [
            { heading: "Text and URLs", text: "The text is encoded exactly as you enter it. It is not trimmed, normalized or rewritten, so spaces, capitalization, Unicode and emoji are kept as typed, and a URL is not changed or given a missing https://. The tool does not fetch, open or check URLs." },
            { heading: "Fixed QR settings", text: "Every QR code uses error correction level M, black modules on a white background, a fixed 512 × 512 pixel PNG and the standard four-module quiet zone around the symbol. There are no color, size or error-correction options." },
            { heading: "Payload limit", text: "Text is limited to 2048 UTF-8 bytes, which can be fewer than 2048 characters when the text includes accented letters, non-Latin scripts or emoji. Larger payloads create denser QR symbols, and shorter payloads are generally easier to scan. Not every camera or scanner can read a QR code at the maximum size." },
            { heading: "Local processing", text: "The QR code is generated locally in this browser, and your text is not uploaded for QR generation. It is not saved or placed in the page address. The site still loads ordinary application assets and may use separately enabled site observability, which never receives your text." },
        ],
        relatedToolId: ["length-converter", "weight-converter"],
    },
};

export function getToolGuide(toolId: ToolId): ToolGuide | undefined {
    return Object.hasOwn(guideById, toolId) ? guideById[toolId] : undefined;
}
