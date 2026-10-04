# PDF.js 6.4.299 asset selection

The native worker and fourteen standard fonts support the accepted text/vector,
JPEG/PNG and standard-font corpus. Both Foxit and Liberation fonts are exercised
by standard-fonts.pdf with system-font fallback disabled. Manifest identities
refer to unmodified installed package files and retained upstream licenses.

CMaps are evaluated but not shipped: the accepted corpus uses WinAnsi/Symbol/
Dingbats standard fonts and embedded image data, with no external CJK CMap.
Image-decoding WASM (JBIG2/OpenJPEG/qcms) and fallback JS are evaluated but not
shipped: the foundation fixtures use browser-supported JPEG and PNG embedding,
without JBIG2, JPEG2000 or ICC profiles. The runtime disables WASM for this
foundation. Future render acceptance must explicitly extend and verify this
subset before adding those encodings. No scripting/QuickJS assets are shipped.

All runtime requests are operation-time and same-origin. No precache is added.
