import { readQpdfRequest, type QpdfResponse } from "./qpdf.workerType";
interface QpdfModule { FS: { writeFile(path: string, bytes: Uint8Array): void; readFile(path: string): Uint8Array; unlink(path: string): void }; callMain(argument: string[]): number }
interface QpdfFactory { default(option: { locateFile(name: string): string; print(message: string): void; printErr(message: string): void }): Promise<QpdfModule> }
const scope = self as unknown as { location: Location; onmessage: ((event: MessageEvent) => void) | null; postMessage(response: QpdfResponse, transfer?: Transferable[]): void };
let used = false;
scope.onmessage = async event => {
    if (used) return;
    used = true;
    const request = readQpdfRequest(event.data);
    if (!request) return;
    let runtime: QpdfModule | undefined;
    let initialized = false;
    let diagnostic = "";
    const capture = (message: string) => { diagnostic = (diagnostic + message).slice(0, 4096); };
    const cleanup = () => {
        for (const file of ["/input.pdf", "/output.pdf"]) { try { runtime?.FS.unlink(file); } catch { /* File may not exist. */ } }
    };
    try {
        const root = new URL("/vendor/qpdf/12.4.2/", scope.location.origin).href;
        const glueUrl = `${root}qpdf.js`;
        const factory = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ glueUrl) as QpdfFactory;
        runtime = await factory.default({ locateFile: name => `${root}${name}`, print: capture, printErr: capture });
        initialized = true;
        runtime.FS.writeFile("/input.pdf", request.bytes);
        const run = (argument: string[]): number => {
            try { return runtime!.callMain(argument); }
            catch (error) {
                if (error && typeof error === "object" && "name" in error && error.name === "ExitStatus" && "status" in error && typeof error.status === "number") return error.status;
                throw error;
            }
        };
        const encryption = run(["--is-encrypted", "/input.pdf"]);
        if (encryption === 0) { cleanup(); scope.postMessage({ id: request.id, status: "error", category: "encrypted" }); return; }
        if (encryption !== 2) throw new Error("QPDF input check failed");
        diagnostic = "";
        if (run(["--deterministic-id", "/input.pdf", "/output.pdf"]) !== 0) throw new Error("QPDF operation failed");
        const bytes = runtime.FS.readFile("/output.pdf").slice();
        cleanup();
        scope.postMessage({ id: request.id, status: "success", bytes }, [bytes.buffer]);
    } catch { cleanup(); scope.postMessage({ id: request.id, status: "error", category: initialized ? "processing" : "initialization" }); }
    finally { diagnostic = ""; }
};
