import SevenZipFactory from "7z-wasm";
import { MANIFEST_7ZZ_WASM } from "~/config/manifest-list";

const sevenZipWasmUrl = MANIFEST_7ZZ_WASM;

type WorkerRequestAction =
  | "callMain"
  | "fsWriteFile"
  | "fsReadFile"
  | "fsOpen"
  | "fsWrite"
  | "fsClose"
  | "fsUnlink"
  | "fsMkdir"
  | "fsRmdir"
  | "fsReaddir"
  | "fsStat";

interface WorkerRequest {
  id      : number;
  action  : WorkerRequestAction;
  payload?: Record<string, unknown>;
}

interface WorkerResponse {
  id     : number;
  ok     : boolean;
  result?: unknown;
  error? : string;
}

interface WorkerLogMessage {
  type   : "log";
  payload: {
    id    : number;
    stream: "stdout" | "stderr";
    text  : string;
  };
}

interface SevenZipCommandResult {
  exitCode: number;
  stdout  : string;
  stderr  : string;
}

type SevenZipCapture = { stdout: string[]; stderr: string[]; active: boolean };

type SevenZipModule = Awaited<ReturnType<typeof SevenZipFactory>> & {
  __capture?: SevenZipCapture;
};

// Normalize DOM lib typing by pinning to the worker scope without WebWorker lib types.
type WorkerScope = {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
  onmessage  : typeof self.onmessage;
};
const workerScope = self as unknown as WorkerScope;

// Use an explicit FS stream type to bridge worker payloads.
type SevenZipFsStream = Parameters<SevenZipModule["FS"]["write"]>[0];

let sevenZipPromise: Promise<SevenZipModule> | null = null;
let activeRequestId: number | null = null;

/**
 * Lazily initialize the 7-Zip WASM module inside the worker.
 */
async function getSevenZip(): Promise<SevenZipModule> {
  if (!sevenZipPromise) {
    sevenZipPromise = (async function loadSevenZip() {
      const capture: SevenZipCapture = { stdout: [], stderr: [], active: false };
      const module = await SevenZipFactory({
        locateFile: function locateFile(path: string, scriptDirectory: string) {
          if (path && path.endsWith(".wasm")) return sevenZipWasmUrl;
          return `${scriptDirectory}${path}`;
        },
        print: function handleStdout(text: string) {
          if (!capture.active) return;
          const message = String(text);
          capture.stdout.push(message);
          emitLog("stdout", message);
        },
        printErr: function handleStderr(text: string) {
          if (!capture.active) return;
          const message = String(text);
          capture.stderr.push(message);
          emitLog("stderr", message);
        },
      }) as SevenZipModule;
      module.__capture = capture;
      return module;
    })();
  }
  return sevenZipPromise;
}

workerScope.onmessage = function handleMessage(event: MessageEvent<WorkerRequest>) {
  const request = event.data;
  if (!request || typeof request.id !== "number") return;
  handleRequest(request).catch((error) => {
    workerScope.postMessage({
      id   : request.id,
      ok   : false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies WorkerResponse);
  });
};

/**
 * Route incoming RPC calls to the 7-Zip instance.
 */
async function handleRequest(request: WorkerRequest) {
  const sevenZip = await getSevenZip();
  const { action, payload } = request;

  if (action === "callMain") {
    const args = Array.isArray(payload?.args) ? payload?.args as string[] : [];
    activeRequestId = request.id;
    const result = runSevenZipCall(sevenZip, args);
    activeRequestId = null;
    return postResult(request.id, result);
  }

  if (action === "fsWriteFile") {
    const path = String(payload?.path ?? "");
    const buffer = payload?.buffer as ArrayBuffer;
    const bytes = new Uint8Array(buffer);
    sevenZip.FS.writeFile(path, bytes);
    return postResult(request.id, null);
  }

  if (action === "fsReadFile") {
    const path = String(payload?.path ?? "");
    const bytes = sevenZip.FS.readFile(path) as Uint8Array;
    const copied = bytes.slice();
    return postResult(request.id, copied.buffer, [copied.buffer]);
  }

  if (action === "fsOpen") {
    const path = String(payload?.path ?? "");
    const flags = String(payload?.flags ?? "r");
    const fd = sevenZip.FS.open(path, flags);
    return postResult(request.id, fd);
  }

  if (action === "fsWrite") {
    const fd = Number(payload?.fd ?? 0) as unknown as SevenZipFsStream;
    const buffer = payload?.buffer as ArrayBuffer;
    const bytes = new Uint8Array(buffer);
    const offset = Number(payload?.offset ?? 0);
    const length = Number(payload?.length ?? bytes.length);
    const position = typeof payload?.position === "number" ? payload?.position as number : undefined;
    const written = sevenZip.FS.write(fd, bytes, offset, length, position);
    return postResult(request.id, written);
  }

  if (action === "fsClose") {
    const fd = Number(payload?.fd ?? 0) as unknown as SevenZipFsStream;
    sevenZip.FS.close(fd);
    return postResult(request.id, null);
  }

  if (action === "fsUnlink") {
    const path = String(payload?.path ?? "");
    sevenZip.FS.unlink(path);
    return postResult(request.id, null);
  }

  if (action === "fsMkdir") {
    const path = String(payload?.path ?? "");
    sevenZip.FS.mkdir(path);
    return postResult(request.id, null);
  }

  if (action === "fsRmdir") {
    const path = String(payload?.path ?? "");
    sevenZip.FS.rmdir(path);
    return postResult(request.id, null);
  }

  if (action === "fsReaddir") {
    const path = String(payload?.path ?? ".");
    const entries = sevenZip.FS.readdir(path);
    return postResult(request.id, entries);
  }

  if (action === "fsStat") {
    const path = String(payload?.path ?? "");
    const stat = sevenZip.FS.stat(path);
    return postResult(request.id, {
      mode : stat.mode,
      size : stat.size,
      mtime: stat.mtime instanceof Date ? stat.mtime.getTime() : stat.mtime,
    });
  }

  return postResult(request.id, null);
}

/**
 * Execute a 7-Zip command and capture stdout/stderr output.
 */
function runSevenZipCall(sevenZip: SevenZipModule, args: string[]): SevenZipCommandResult {
  const capture = sevenZip.__capture ?? { stdout: [], stderr: [], active: false };
  capture.stdout = [];
  capture.stderr = [];
  capture.active = true;
  let exitCode = 0;
  try {
    exitCode = Number(sevenZip.callMain(args));
  } finally {
    capture.active = false;
  }
  return { exitCode, stdout: capture.stdout.join("\n"), stderr: capture.stderr.join("\n") };
}

/**
 * Emit a log line for the active request.
 */
function emitLog(stream: "stdout" | "stderr", text: string) {
  if (activeRequestId === null) return;
  workerScope.postMessage({
    type   : "log",
    payload: {
      id: activeRequestId,
      stream,
      text,
    },
  } satisfies WorkerLogMessage);
}

/**
 * Post a successful response back to the main thread.
 */
function postResult(id: number, result: unknown, transfer: Transferable[] = []) {
  workerScope.postMessage({ id, ok: true, result } satisfies WorkerResponse, transfer);
}
