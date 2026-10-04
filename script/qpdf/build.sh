#!/bin/bash
set -euo pipefail
export SOURCE_DATE_EPOCH=0
export BINARYEN_CORES=1
export TZ=UTC LANG=C LC_ALL=C PYTHONHASHSEED=0
export EM_CACHE=/work/cache
export EMCC_TEMP_DIR=/work/tmp
umask 0022
mkdir -p /work/cache /work/tmp /output
test -z "$(find /work/cache -mindepth 1 -print -quit)"
env | sort > /output/environment.txt
{ emcc --version; /emsdk/upstream/bin/clang --version; /emsdk/upstream/bin/wasm-opt --version; cmake --version; make --version; python3 --version; umask; uname -m; pwd; } > /output/tools.txt
emcc --version
cat /emsdk/upstream/emscripten/tools/ports/zlib.py
cat /emsdk/upstream/emscripten/tools/ports/libjpeg.py
mkdir -p /work/out
embuilder build sysroot
embuilder build zlib libjpeg
sysroot=$(em-config CACHE)/sysroot
flags='-fwasm-exceptions -O3 -ffile-prefix-map=/work=.'
link='-fwasm-exceptions -O0 -g0 -sASSERTIONS=0 -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createQpdfModule -sENVIRONMENT=web,worker,node -sALLOW_MEMORY_GROWTH=1 -sSTACK_SIZE=2097152 -sINVOKE_RUN=0 -sEXIT_RUNTIME=0 -sEXPORTED_RUNTIME_METHODS=FS,callMain'
emcmake cmake -S /source -B /work/build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DBUILD_STATIC_LIBS=ON -DBUILD_DOC=OFF -DINSTALL_EXAMPLES=OFF -DUSE_IMPLICIT_CRYPTO=OFF -DREQUIRE_CRYPTO_NATIVE=ON -DPKG_CONFIG_EXECUTABLE=/usr/bin/false -DZLIB_H_PATH="$sysroot/include" -DZLIB_LIB_PATH="$sysroot/lib/wasm32-emscripten/libz.a" -DLIBJPEG_H_PATH="$sysroot/include" -DLIBJPEG_LIB_PATH="$sysroot/lib/wasm32-emscripten/libjpeg.a" -DCMAKE_C_FLAGS="$flags" -DCMAKE_CXX_FLAGS="$flags" -DCMAKE_EXE_LINKER_FLAGS="$link"
cmake --build /work/build --target qpdf -j 4 --verbose
cp /work/build/qpdf/qpdf.js /work/build/qpdf/qpdf.wasm /output/
sha256sum /output/qpdf.*
cp /work/build/CMakeCache.txt /output/

echo '6e9ada6ad324547b01a4c69118b3cf797565439d77df2ed9e6fdfd656565f6d0  /output/qpdf.js' | sha256sum -c -
echo '38ca4cbe43a6767b43058399aef864574b1d5f6bce30b9d70a62037d3ce1c5c0  /output/qpdf.wasm' | sha256sum -c -
