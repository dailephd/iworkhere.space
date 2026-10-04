# Pinned QPDF runtime build

Run `node node_modules/tsx/dist/cli.mjs script/qpdfBuild.ts` from the repository.
Docker must already be available. All source/cache/temp/build evidence remains
under `.my-dev-kit-workflow/v0.3.0-batch1/`. Normal npm install/app build never
invokes this command. The command fails unless the exact canonical artifacts
are reproduced; it does not publish files automatically.

After a rebuild, run
`node node_modules/tsx/dist/cli.mjs script/pdfAssetsVerify.ts` to verify the
committed runtime manifests and retained component notices. The canonical JS
SHA-256 is `6e9ada6ad324547b01a4c69118b3cf797565439d77df2ed9e6fdfd656565f6d0`;
WASM is `38ca4cbe43a6767b43058399aef864574b1d5f6bce30b9d70a62037d3ce1c5c0`.
Targeted Git attributes preserve runtime/notice/fixture bytes and LF shell
endings on Windows. Never replace these identities with an unreviewed build.

`source-lock.json` pins QPDF's annotated tag/peeled source commit, builder digest,
Emscripten, hash-verified SDK zlib/JPEG ports, native crypto and artifact identity.
`build.sh` uses independently empty caches, stable container paths, normalized
environment, explicit static/native crypto flags and the frozen O3 compile/O0
link contract. Sysroot headers are generated before ports in the empty cache.
Independent reproducibility runs must never share generated caches. Retain
their output manifests/logs. Two controlled Batch 1 builds establish byte
identity; the old feasibility artifact is superseded without claiming its
historical discrepancy was isolated.

Maintainer updates require deliberate source/toolchain/port pin review, two
clean builds, hash equality, complete linked-component notices and independent
browser/standalone fixture verification. A successful build is not legal release
approval. Sources and build intermediates must not be copied under public.
