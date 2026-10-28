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

const privacy = "Your image is processed in this browser and is not uploaded. Site analytics and diagnostics never receive your files or results; the Privacy Policy lists what is collected. Keep the page open until processing and the download finish.";
const documentPrivacy = "Your PDF is processed in this browser and is not uploaded. Site analytics and diagnostics never receive your files or results; the Privacy Policy lists what is collected. Keep the page open until processing and the download finish.";
const documentFidelity = "The supported boundary is static pages: page order, dimensions, rotation, visible content and extractable text. Preservation of metadata, bookmarks, attachments, complex interactive forms, accessibility structure and digital signatures or their cryptographic validity is not guaranteed.";

/** Exact inputs shown in the worked examples; guideExample.test.tsx runs each one through the real tool logic. */
export const JSON_GUIDE_MEMBER = ["\"id\":12345678901234567890", "\"n\":1.50E+2", String.raw`"s":"\u00e9"`, "\"s\":2"];
export const JSON_GUIDE_EXAMPLE = `{${JSON_GUIDE_MEMBER.join(",")}}`;
export const COUNTER_GUIDE_DECOMPOSED = "e\u0301";
export const COUNTER_GUIDE_FAMILY = "\u{1F469}\u200D\u{1F469}\u200D\u{1F467}";
export const QR_GUIDE_EXAMPLE = "https://iworkhere.space/tool/qr-code-generator";

const guideById: Partial<Record<ToolId, ToolGuide>> = {
    "slugify": {
        instruction: ["Enter text in the Text input.", "Read the generated slug below the input; it updates as you type.", "Edit the input if the result needs different wording."],
        section: [
            { heading: "Turn a title into a slug", text: "A slug is a short text identifier often used in a URL path. Uppercase English letters become lowercase. Runs of spaces, punctuation and other characters outside a–z and 0–9 become one hyphen; leading and trailing hyphens are removed. Hello World! becomes hello-world, and Ready... Set / Go! becomes ready-set-go." },
            { heading: "ASCII handling and empty results", text: "This tool does not transliterate accented or non-Latin characters into Latin equivalents. For example, Café 東京 becomes caf. Empty input or unsupported-only input such as 東京 or !!! produces an empty slug. If you need those characters, type an English spelling instead." },
            { heading: "Check the destination", text: "The result is a text suggestion, not a uniqueness check. Different titles can produce the same slug; check existing names and the destination's URL rules before using it." },
        ],
        relatedToolId: ["html-text-extractor", "word-character-counter"],
    },
    "length-converter": {
        instruction: ["Enter a number in Value.", "Choose the input unit in From and the desired output unit in To.", "Read Result with its destination-unit abbreviation; changing the value or either unit updates it immediately."],
        section: [
            { heading: "Convert a length", text: "Use this tool to express the same length in another unit. From describes the value you entered; To describes the result. For example, Value 1 with From Meters (m) and To Feet (ft) displays 3.28084 ft. Switching To to Centimeters (cm) displays 100 cm." },
            { heading: "Supported length units", text: "Choose meters (m), kilometers (km), centimeters (cm), millimeters (mm), inches (inch), feet (ft), yards (yd) or miles (mile). Conversion goes through meters; an inch is 0.0254 meters and a mile is 1609.344 meters. Other length units and area or volume conversions are not available." },
            { heading: "Rounding and numeric input", text: "Results are rounded to at most six decimal places, with trailing zeros removed. Very small results can round to zero. The calculation uses ordinary JavaScript numbers, not arbitrary-precision arithmetic; displayed decimals do not guarantee measurement accuracy. The whole value must be a number: a blank value displays Invalid input: enter a number., and a value too large to represent displays Invalid input: the number is too large. If the converted result is too large to represent, such as 1e308 miles in millimeters, the tool shows Result is out of range for this conversion. instead of a number; converting a very large value to the same unit still works, so 1e308 meters stays 1e+308 m. Rounding is only a display choice: it does not make a measurement more or less accurate, so check the selected units and the precision of your source value." },
        ],
        relatedToolId: ["weight-converter", "calculator"],
    },
    "weight-converter": {
        instruction: ["Enter a number in Value.", "Choose the input unit in From and the desired output unit in To.", "Read Result with its destination-unit abbreviation; it updates when the value or either unit changes."],
        section: [
            { heading: "Convert a mass", text: "Although named Weight Converter, this tool converts mass units rather than physical force. From is the unit of the value you enter; To is the unit of the result. Value 1 with From Kilograms (kg) and To Pounds (lb) displays 2.204623 lb. Switching To to Grams (g) displays 1000 g." },
            { heading: "Supported mass units", text: "Choose grams (g), kilograms (kg), pounds (lb) or ounces (oz). Conversion goes through grams, using 453.59237 grams per pound and 28.349523125 grams per ounce. These are ordinary avoirdupois pounds and ounces, not troy units or fluid ounces. No other units or force conversions are offered." },
            { heading: "Rounding and numeric input", text: "Results are rounded to at most six decimal places and trailing zeros are removed. Very small results can round to zero. Ordinary JavaScript numbers have finite precision; this display does not provide arbitrary precision or establish the accuracy of a measurement. The whole value must be a number: a blank value displays Invalid input: enter a number., and a value too large to represent displays Invalid input: the number is too large. If the converted result is too large to represent, such as 1e308 kilograms in grams, the tool shows Result is out of range for this conversion. instead of a number; converting a very large value to the same unit still works, so 1e308 grams stays 1e+308 g. Rounding is only a display choice: it does not make a measurement more or less accurate, so check the selected units and the precision of your source value." },
        ],
        relatedToolId: ["length-converter", "calculator"],
    },
    "html-text-extractor": {
        instruction: ["Paste HTML into HTML Input.", "Select Convert to extract text.", "Review Extracted Text; after editing the HTML, select Convert again to update it.", "Select Copy to copy a non-empty result. If clipboard access fails, select and copy the text manually."],
        section: [
            { heading: "Extract text from HTML", text: "The tool parses the HTML you paste and collects the text of the page body. For example, <p>Hello <strong>world</strong><br>Next line</p><script>ignored()</script> produces Hello world followed by a line break and Next line. Script and style subtrees are excluded." },
            { heading: "Line breaks and whitespace", text: "A br element inserts a line break. Selected structural elements, including paragraphs, headings, list items and table cells, add a break after their contents. Runs of spaces and tabs within text nodes are reduced to one space, trailing whitespace on each line is removed, three or more consecutive line breaks become two, and the final result is trimmed. Empty HTML produces empty text." },
            { heading: "Extraction limits", text: "This is DOM-based extraction, not full browser visual-text rendering. CSS computed visibility is not checked, so text hidden with CSS may still appear. Browser layout, generated CSS content and image descriptions are not reproduced. This is not an HTML sanitizer and does not make markup safe for subsequent HTML rendering. Review the extracted text before reusing it." },
        ],
        relatedToolId: ["word-character-counter", "slugify"],
    },
    "compress-pdf": {
        instruction: ["Choose one PDF.", "Select Compress PDF.", "Wait while the PDF is compressed and checked in your browser.", "If the verified result is smaller, download it.", "If no smaller output is produced, keep the original."],
        section: [
            { heading: "What this compression does", text: "QPDF restructures and compresses PDF objects and streams. Pages are not rasterized. This mode is lossless with respect to the supported static-page semantics; image quality is not intentionally reduced. There is one mode: lossless structural compression." },
            { heading: "No reduction is normal", text: "Already optimized PDFs may stay the same size or grow slightly. A download is offered only when the checked result is actually smaller. When the tool reports NO REDUCTION ACHIEVED, it discards the new file because your original is already the smaller one." },
            { heading: "Supported PDFs and limits", text: "Choose one valid PDF no larger than 10 MiB and with at most 100 pages. Encrypted or password-protected PDFs are unsupported. Malformed PDFs cannot be safely processed; this tool does not offer repair." },
            { heading: "Fidelity boundary", text: `${documentFidelity} Smaller results independently verify page geometry, rotation, extractable text and representative visible content before download. Arbitrary PDF extensions are outside this boundary.` },
            { heading: "Local processing", text: `${documentPrivacy} Compression runs in a short-lived browser worker using QPDF compiled to WebAssembly, so no document bytes leave your device.` },
        ],
        relatedToolId: ["merge-pdf", "split-pdf", "images-to-pdf", "pdf-to-image"],
    },
    "pdf-to-image": {
        instruction: ["Choose one PDF.", "Enter page numbers or ranges such as 1-3 or 3,1.", "Choose PNG or JPG.", "Choose 72, 150 or 300 DPI.", "Adjust quality when JPG is selected.", "Select Convert pages.", "Download each converted page individually after verification."],
        section: [
            { heading: "Page selection", text: "Use a single page (1), an ascending range (1-3), a comma list (1,3,5), or a combination (1-3,6,9-10). Pages are exported in the order you list them: 3,1 exports page 3 before page 1. A repeated page is exported once, at its first position. At most 20 output images are supported, and there is no ZIP file or download-all button." },
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
            { heading: "One image per page", text: "Each image becomes one PDF page in the displayed order. An image's pixel width and height become the page size in PDF points: a 1200 × 800 image creates a 1200 × 800 point page. Aspect ratio is preserved. There are no paper-size, margin, cropping or layout controls; DPI metadata does not change page size." },
            { heading: "Supported images and limits", text: "JPEG and PNG only; WebP and HEIC are unsupported by this tool. Choose up to 20 images, at most 25 MiB together. Each non-empty image also obeys the 25 MiB source limit and 30 megapixels decoded-area limit. Encoded content and successful browser decoding are checked; a rejected selection batch leaves accepted images unchanged." },
            { heading: "Transparency and output caveats", text: "PNG alpha is embedded without an intentional white flattening step. Viewer and page-background presentation may affect how transparency appears. This does not promise a portable transparent PDF page. Metadata preservation is not promised." },
            { heading: "Local image and PDF processing", text: "Your images are read and the PDF is created in this browser; the images are not uploaded. Site analytics and diagnostics never receive your files or results; the Privacy Policy lists what is collected. Keep the page open until processing and the download finish." },
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
            { heading: "Page groups and syntax", text: "Use a single page (1), an ascending range (1-3), a comma list (1,3,5), or a combination (1-3,6,9-10). Pages stay in the order you list them, so 3,1 puts page 3 before page 1. Within one group the first occurrence of a page is retained; separate groups may overlap. Up to 20 output groups are supported." },
            { heading: "PDF limits and individual downloads", text: "The source must be no larger than 10 MiB and have at most 100 pages. Encrypted or password-protected PDFs are unsupported; malformed PDFs cannot be safely processed. Each group produces a separate PDF in group order. There is no ZIP file or download-all button." },
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
            { heading: "Your values are not changed", text: "Formatting and minifying change only insignificant whitespace. Numbers, string escape spelling, true/false/null, member order and duplicate member names are copied exactly as written. Nothing is converted to a JavaScript value first, so very large integers, exponent notation, -0 and escaped Unicode are not coerced, normalized, collapsed or reordered." },
            { heading: "Check it with this input", text: `Take one object with four members and no whitespace between them: ${JSON_GUIDE_MEMBER.join(", ")}. The name "s" appears twice. Minify JSON returns the object unchanged, because there is no whitespace to remove. Format JSON puts each member on its own line with 2-space indentation and changes nothing else, so the 20-digit integer 12345678901234567890, the exponent 1.50E+2, the \\u00e9 escape and the repeated "s" member name all survive. For {"a":1,} the tool reports "Trailing commas are not allowed." at line 1, column 8; remove the comma and format again.` },
            { heading: "Size limit", text: "Input is limited to 1 MiB of UTF-8. Larger input is rejected before it is checked. Pretty-printing extremely deeply nested JSON can produce very large output; if that would happen the tool stops with an explanation, and Minify still works." },
            { heading: "Local processing", text: "JSON is processed in this browser and is not uploaded. Site analytics and diagnostics never receive your JSON; the Privacy Policy lists what is collected." },
        ],
        relatedToolId: ["html-text-extractor", "slugify"],
    },
    "word-character-counter": {
        instruction: ["Enter or paste text into the Text box.", "Review the four live counts: Words, Characters, Characters excluding whitespace and Lines.", "Edit the text as needed; the counts update as you type.", "Select Reset to clear the text and return every count to zero."],
        section: [
            { heading: "Word counting", text: "A word is a run of Unicode letters and numbers. Combining marks stay with the run they follow, and a single straight (') or curly (’) apostrophe between two runs joins them, so don't and don’t are one word. Punctuation around a word is not counted. Hyphens, underscores and slashes separate words, so well-known counts as two words. The rule does not depend on the language or locale, and a continuous run of Chinese, Japanese or Korean characters counts as one word." },
            { heading: "Character counting", text: "Characters are Unicode grapheme clusters, the units a reader sees as one character. An accented letter written with a combining accent, an emoji with a skin tone, an emoji sequence joined by zero-width joiners and a flag each count once. This needs the browser's built-in Intl.Segmenter support; without it the tool says so instead of showing an approximate count." },
            { heading: "Whitespace and lines", text: "Characters excluding whitespace removes characters with the Unicode White_Space property, including spaces, tabs, line breaks, non-breaking spaces and ideographic spaces. A zero-width space (U+200B) is not White_Space and is counted. Lines are separated by CRLF, CR or LF only: empty text has zero lines, any other text has one more line than it has separators, so a trailing line break starts another line. Unicode NEL, line separator and paragraph separator characters do not start a new line." },
            { heading: "Counting examples", text: `Don’t is 1 word and 5 characters, because the apostrophe is a character. ${COUNTER_GUIDE_DECOMPOSED} (e followed by a combining acute accent) is 1 character, and ${COUNTER_GUIDE_FAMILY} (an emoji family joined by zero-width joiners) is 1 character but 0 words, because emoji are not letters or numbers. The text Hello world followed by one line break is 2 words, 12 characters, 10 characters excluding whitespace and 2 lines, because the trailing line break starts a second, empty line.` },
            { heading: "Limits and local processing", text: "Text is limited to 1 MiB of UTF-8; larger text is not counted and is not truncated. Counting happens in this browser. Your text is not uploaded, saved or placed in the page address, and site analytics and diagnostics never receive it." },
        ],
        relatedToolId: ["slugify", "html-text-extractor"],
    },
    "qr-code-generator": {
        instruction: ["Enter text or a URL in the Text or URL box.", "Select Generate QR code.", "Scan or review the preview.", "Select Download PNG to save the image if needed.", "Select Reset to clear the text and the QR code."],
        section: [
            { heading: "Text and URLs", text: "The text is encoded exactly as you enter it. It is not trimmed, normalized or rewritten, so spaces, capitalization, Unicode and emoji are kept as typed, and a URL is not changed or given a missing https://. The tool does not fetch, open or check URLs." },
            { heading: "Fixed QR settings", text: "Every QR code uses error correction level M, black modules on a white background, a fixed 512 × 512 pixel PNG and the standard four-module quiet zone around the symbol. There are no color, size or error-correction options." },
            { heading: "Payload limit", text: "Text is limited to 2048 UTF-8 bytes, which can be fewer than 2048 characters when the text includes accented letters, non-Latin scripts or emoji. Larger payloads create denser QR symbols, and shorter payloads are generally easier to scan. Not every camera or scanner can read a QR code at the maximum size." },
            { heading: "Example and what to do if it will not scan", text: `Entering ${QR_GUIDE_EXAMPLE} and selecting Generate QR code produces a 512 × 512 pixel PNG that an independent QR reader decodes to exactly that text. If a code will not scan, shorten the text, because a short URL makes a simpler code; display or print the image larger on a plain light background; and check the text for a stray space or a typing error, because it is encoded exactly as entered. If the tool shows "QR code text must be 2,048 UTF-8 bytes or less.", shorten the text and generate again.` },
            { heading: "Local processing", text: "The QR code is generated in this browser. Your text is not uploaded, saved or placed in the page address, and site analytics and diagnostics never receive it." },
        ],
        relatedToolId: ["json-formatter", "slugify"],
    },
    "calculator": {
        instruction: ["Enter an expression in Expression, typing on the keyboard or using the on-screen keypad.", "Press Enter or = on the keyboard, or select the = button, to evaluate it.", "Read the answer in the Result area; if the expression cannot be evaluated, an error message appears there instead.", "Select C to clear the expression, or ⌫ to remove its last character."],
        section: [
            { heading: "Basic arithmetic", text: "The calculator handles whole and decimal numbers with addition (+), subtraction (-), multiplication (*) and division (/). The keypad buttons × and ÷ insert * and /. Spaces are ignored. 2 + 3 * 4 gives 14, 7 / 2 gives 3.5 and 0.5 + 0.25 gives 0.75." },
            { heading: "Operator precedence and parentheses", text: "Multiplication and division are done before addition and subtraction, and operators of equal rank are applied from left to right. So 2 + 3 * 4 is 2 + 12 = 14. Parentheses group part of an expression so it is calculated first: (2 + 3) * 4 gives 20. Parentheses can be nested. Write multiplication explicitly; 2(3) is not read as 2 * 3 and produces an error." },
            { heading: "Negative numbers", text: "A plus or minus sign directly in front of a number, a parenthesis or another sign is a sign, not a subtraction, and it is applied before multiplication and division: -5 + 2 gives -3, 2 * -3 gives -6, 2 / -2 gives -1, 1--2 gives 3, -(2 + 3) gives -5 and --2 gives 2. Parentheses are optional, so 2 * (-3) also gives -6." },
            { heading: "Invalid expressions and numeric limits", text: "Characters other than digits, a decimal point, spaces, + - * / and parentheses are rejected, for example Invalid character: \"&\". Pressing = on an empty expression gives Enter an expression to calculate. An incomplete expression such as 2 + gives Invalid expression., unbalanced parentheses such as (2 + 3 give Mismatched parentheses., and dividing by zero or any result too large to represent gives Result is not finite. There are no functions, exponents, percentages, units, symbolic algebra or arbitrary-precision arithmetic. Numbers use ordinary finite-precision floating-point arithmetic, and a fractional result is shown rounded to at most 12 decimal places: 1 / 3 shows 0.333333333333, and 0.1 + 0.2 shows 0.3. Treat results as practical approximations, not exact mathematics for very large, very small or highly precise values." },
            { heading: "Sharing expressions and privacy", text: "The calculator runs in this browser, but the expression is also written to the page address as an expr query parameter as you type, so a copied address can reproduce it. Anyone or any service that receives or records that address, such as a person you send it to or browser history, can see the expression. Do not enter sensitive information such as account numbers, salaries or private figures if you plan to share or save the address. Select C to clear the expression from the address." },
        ],
        relatedToolId: ["time-arithmetic", "length-converter", "weight-converter"],
    },
    "time-arithmetic": {
        instruction: ["Enter the first duration in Time A, such as 01:50.", "Select Add or Subtract in Operation.", "Enter the second duration in Time B, such as 00:20.", "Read Result, which updates automatically as you type.", "If a field shows a format message or a negative-result alert appears, correct the input."],
        section: [
            { heading: "Adding durations", text: "Time Arithmetic adds lengths of time written as hours and minutes. Both values are converted to total minutes, added, and shown again as hours and minutes, so every 60 minutes carries into one hour. 01:50 + 00:20 gives 02:10, and 50:00 + 50:00 gives 100:00." },
            { heading: "Subtracting durations", text: "Subtraction takes Time B away from Time A. When the minutes of Time B are larger, an hour is borrowed from Time A, so 02:00 - 00:45 gives 01:15. Subtracting equal durations gives 00:00: 01:30 - 01:30 is 00:00. The result cannot be negative; 00:45 - 02:00 shows an alert that subtraction cannot produce a negative time value." },
            { heading: "Input format and validation", text: "Enter hours, a colon and exactly two minute digits (H:MM or HH:MM). A single-digit hour such as 9:05 is accepted, and hours may exceed 23, so 120:05 is a valid duration. Minutes must be 00 to 59: 01:5 and 01:60 are invalid. Negative values such as -1:00 are invalid. An invalid Time A or Time B shows a message under that field, and Result stays --:--. Results always show at least two hour digits. Hours are exact up to a very large limit (a duration of 150119987579016:31 is the largest accepted); anything larger is treated as an invalid entry, and an addition whose result would pass that limit shows an alert that the result is too large to calculate exactly instead of rounding." },
            { heading: "Durations versus clock times", text: "This tool works with durations, amounts of time, not times of day. 25:00 means 25 hours, not 1:00 AM the next day. It does not handle calendar dates, time zones, daylight-saving changes, seconds, AM or PM, or scheduling, and it cannot show a negative duration." },
            { heading: "Local input and limitations", text: "Your entries stay on this page. They are not saved or placed in the page address, so reloading clears them, and site analytics and diagnostics never receive them." },
        ],
        relatedToolId: ["calculator", "length-converter"],
    },
};

export function getToolGuide(toolId: ToolId): ToolGuide | undefined {
    return Object.hasOwn(guideById, toolId) ? guideById[toolId] : undefined;
}
