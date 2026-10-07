import { encode } from "uqr";

export const QR_MAX_PAYLOAD_BYTES = 2048;
export const QR_OUTPUT_SIZE = 512;
export const QR_ERROR_CORRECTION = "M";
export const QR_QUIET_ZONE_MODULES = 4;

export type QrErrorCode = "empty-input" | "input-too-large" | "encoder-failure";

export interface QrError {
    code: QrErrorCode;
    message: string;
}

export interface QrRaster {
    width: number;
    height: number;
    data: Uint8ClampedArray;
    moduleScale: number;
    offsetX: number;
    offsetY: number;
}

export type QrMatrixResult = { ok: true; matrix: boolean[][] } | { ok: false; error: QrError };
export type QrRasterResult = { ok: true; raster: QrRaster } | { ok: false; error: QrError };

const MESSAGE: Record<QrErrorCode, string> = {
    "empty-input": "Enter text or a URL to generate a QR code.",
    "input-too-large": "QR code text must be 2,048 UTF-8 bytes or less.",
    "encoder-failure": "Could not generate the QR code.",
};

function fail(code: QrErrorCode): { ok: false; error: QrError } {
    return { ok: false, error: { code, message: MESSAGE[code] } };
}

export function generateQrMatrix(text: string): QrMatrixResult {
    if (text.length === 0) return fail("empty-input");

    const bytes = new TextEncoder().encode(text);
    if (bytes.length > QR_MAX_PAYLOAD_BYTES) return fail("input-too-large");

    try {
        // A plain number[] selects the encoder's byte mode; the payload is encoded exactly as typed.
        const result = encode(Array.from(bytes), { ecc: QR_ERROR_CORRECTION, boostEcc: false, border: 0 });
        return { ok: true, matrix: result.data };
    } catch {
        return fail("encoder-failure");
    }
}

export function renderQrRaster(matrix: boolean[][]): QrRaster {
    const moduleCount = matrix.length;
    const moduleScale = Math.floor(QR_OUTPUT_SIZE / (moduleCount + QR_QUIET_ZONE_MODULES * 2));
    if (moduleCount === 0 || moduleScale < 1 || matrix.some(row => row.length !== moduleCount)) {
        throw new RangeError("Invalid QR matrix.");
    }

    const offset = Math.floor((QR_OUTPUT_SIZE - moduleCount * moduleScale) / 2);
    const data = new Uint8ClampedArray(QR_OUTPUT_SIZE * QR_OUTPUT_SIZE * 4).fill(255);

    for (let row = 0; row < moduleCount; row += 1) {
        for (let column = 0; column < moduleCount; column += 1) {
            if (!matrix[row][column]) continue;
            for (let dy = 0; dy < moduleScale; dy += 1) {
                const rowStart = (offset + row * moduleScale + dy) * QR_OUTPUT_SIZE;
                for (let dx = 0; dx < moduleScale; dx += 1) {
                    const index = (rowStart + offset + column * moduleScale + dx) * 4;
                    data[index] = 0;
                    data[index + 1] = 0;
                    data[index + 2] = 0;
                }
            }
        }
    }

    return { width: QR_OUTPUT_SIZE, height: QR_OUTPUT_SIZE, data, moduleScale, offsetX: offset, offsetY: offset };
}

export function generateQrRaster(text: string): QrRasterResult {
    const matrix = generateQrMatrix(text);
    if (!matrix.ok) return matrix;
    try {
        return { ok: true, raster: renderQrRaster(matrix.matrix) };
    } catch {
        return fail("encoder-failure");
    }
}
