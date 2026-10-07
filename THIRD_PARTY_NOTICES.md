# Third-party notices

## heic-to 1.5.2

Upstream: https://github.com/hoppergee/heic-to

The exact installed package version is 1.5.2. npm package license metadata is
`LGPL-3.0`. Its upstream README identifies bundled libheif version 1.22.2.
The unmodified installed `node_modules/heic-to/LICENSE` is preserved at
`public/licenses/heic-to-LICENSE.txt`.

## libheif 1.22.2

Upstream: https://github.com/strukturag/libheif

Upstream distributes the library under the GNU Lesser General Public License.
The exact root COPYING from tag v1.22.2, including its license texts, is
preserved at `public/licenses/libheif-COPYING.txt`.
Source: https://github.com/strukturag/libheif/blob/v1.22.2/COPYING

These engineering notice and license-copy artifacts do not establish that the
application's final distribution satisfies every LGPL obligation. The owner
reviewed the production-license evidence and approved the HEIC release gate for
v0.2.0: `HEIC_RELEASE_LICENSE_APPROVAL = APPROVED_BY_OWNER`;
`HEIC_RELEASE_READY = YES`.

The separate MIT synthetic image fixture license is recorded in
`test/fixtures/images/README.md`; it does not resolve the decoder release gate.

## PDF foundation

PDF.js 6.4.299 (Apache-2.0) is distributed with its native worker and the
standard-font files exercised by the fourteen-font fixture. Exact upstream
license texts, including Foxit and Liberation font terms, are preserved under
`public/licenses/pdfjs-6.4.299/`. pdf-lib 1.17.1 is MIT; its license is preserved
at `public/licenses/pdf-lib-1.17.1-LICENSE.md`. Its installed dependencies are
@pdf-lib/standard-fonts 1.0.0 (MIT), @pdf-lib/upng 1.0.1 (MIT), pako 1.0.11
(MIT AND Zlib) and tslib 1.14.1 (0BSD). Their unmodified license texts and pako
zlib-source notices are preserved in `public/licenses/pdf-lib-1.17.1/`.

Project-owned QPDF 12.4.2 WASM uses the exact pinned Emscripten 4.0.15 recipe
and native crypto. `public/licenses/qpdf-12.4.2/NOTICE.md` maps distributed
components to retained source notices, including QPDF Apache-2.0, sphlib MIT/
native AES attribution, RSA MD5, zlib, IJG libjpeg, Emscripten, musl, LLVM
C++/ABI/unwinding/compiler runtime and dlmalloc. This software is based in part
on the work of the Independent JPEG Group. Native MD5 derives from the RSA
Data Security, Inc. MD5 Message-Digest Algorithm.

Versioned runtime manifests record purpose, source version, byte identity and
notice ownership. `script/qpdf/README.md` documents controlled rebuilds.
These records describe factual source correspondence and do not claim legal
approval. No QuickJS, scripting runtime or remote runtime code is distributed.

## QR Code Generator

### uqr 0.1.3 (production)

Upstream: https://github.com/unjs/uqr (npm package metadata
`git+https://github.com/unjs/uqr.git`).

The exact installed package version is 0.1.3. npm package license metadata is
`MIT`. It is the QR encoder used by the QR Code Generator tool and is bundled
into the client JavaScript for that tool; it has no runtime dependencies and
makes no network requests. The unmodified installed `node_modules/uqr/LICENSE`
(Project Nayuki and Anthony Fu copyright notices) is preserved at
`public/licenses/uqr-0.1.3-LICENSE.txt`.

### jsQR 1.4.0 (test only)

Upstream: https://github.com/cozmo/jsQR (npm package metadata
`git+https://github.com/cozmo/jsQR.git`).

The exact installed package version is 1.4.0. npm package license metadata is
`Apache-2.0`. It is a devDependency used only by unit and browser tests to decode
project-rendered and downloaded QR pixels independently of the encoder. It is
not imported by production code and is not distributed with the application.

These records describe factual package, license and distribution state and make
no legal-compliance claim.
