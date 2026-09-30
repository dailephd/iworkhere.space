import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { startHeicOperation } from "./heicConverter.client";

class WorkerFixture {
    static instance: WorkerFixture[] = [];
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessageerror: (() => void) | null = null;
    terminate = vi.fn();
    postMessage = vi.fn();
    constructor() { WorkerFixture.instance.push(this); }
    respond(data: unknown) { this.onmessage?.({ data } as MessageEvent); }
}
beforeEach(() => { WorkerFixture.instance = []; vi.stubGlobal("Worker", WorkerFixture); });
afterEach(() => vi.unstubAllGlobals());
const file = new File(["data"], "test.heic");
const success = { id: 1, status: "inspected", sourceWidth: 50, sourceHeight: 25, previewBlob: new Blob(["png"], { type: "image/png" }) };

it("size precheck constructs no worker for empty or oversized sources", () => {
    expect(() => startHeicOperation({ id: 1, operation: "inspect", file: new File([], "empty.heic") })).toThrow();
    expect(() => startHeicOperation({ id: 1, operation: "inspect", file: new File([new Uint8Array(26_214_401)], "large.heic") })).toThrow();
    expect(WorkerFixture.instance).toHaveLength(0);
});
it("terminal inspection success terminates exactly once", async () => {
    const operation = startHeicOperation({ id: 1, operation: "inspect", file });
    const worker = WorkerFixture.instance[0];
    worker.respond(success);
    await expect(operation.promise).resolves.toEqual(success);
    operation.cancel();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
});
it("ignores stale identities and cancels/settles pending operations", async () => {
    const operation = startHeicOperation({ id: 1, operation: "inspect", file });
    const worker = WorkerFixture.instance[0];
    const handler = worker.onmessage;
    worker.respond({ ...success, id: 0 });
    expect(worker.terminate).not.toHaveBeenCalled();
    const cancelled = expect(operation.promise).rejects.toMatchObject({ name: "AbortError" });
    operation.cancel();
    handler?.({ data: success } as MessageEvent);
    await cancelled;
    expect(worker.onmessage).toBeNull();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
});
it("bounded worker error terminates and rejects without diagnostic leakage", async () => {
    const operation = startHeicOperation({ id: 1, operation: "inspect", file });
    const failure = expect(operation.promise).rejects.toMatchObject({ category: "decode-failed" });
    WorkerFixture.instance[0].respond({ id: 1, status: "error", category: "decode-failed" });
    await failure;
    expect(WorkerFixture.instance[0].terminate).toHaveBeenCalledOnce();
});
it("conversion MIME mismatch is a recoverable encode failure", async () => {
    const operation = startHeicOperation({ id: 1, operation: "convert", file, target: "jpeg", quality: 60 });
    const failure = expect(operation.promise).rejects.toMatchObject({ category: "encode-failed" });
    WorkerFixture.instance[0].respond({ id: 1, status: "converted", sourceWidth: 50, sourceHeight: 25, blob: new Blob(["png"], { type: "image/png" }) });
    await failure;
    expect(WorkerFixture.instance[0].terminate).toHaveBeenCalledOnce();
});
it("malformed terminal response terminates as a safe failure", async () => {
    const operation = startHeicOperation({ id: 1, operation: "inspect", file });
    const failure = expect(operation.promise).rejects.toMatchObject({ category: "unexpected-worker-failure" });
    WorkerFixture.instance[0].respond({ ...success, stack: "private" });
    await failure;
    expect(WorkerFixture.instance[0].terminate).toHaveBeenCalledOnce();
});
it("browser worker errors terminate without exposing their message", async () => {
    const operation = startHeicOperation({ id: 1, operation: "inspect", file });
    const failure = expect(operation.promise).rejects.toMatchObject({ category: "unexpected-worker-failure" });
    WorkerFixture.instance[0].onerror?.({ preventDefault: vi.fn(), message: "private" } as unknown as ErrorEvent);
    await failure;
    expect(WorkerFixture.instance[0].terminate).toHaveBeenCalledOnce();
});
