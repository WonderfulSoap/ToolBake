// Use relative path instead of ~ alias to avoid breaking vite.config.ts compilation
// (vite.config.ts imports embedded-packages.ts which imports this file)
import { MANIFEST_7Z_WORKER_JS } from "../config/manifest-list";

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

interface WorkerRequest {
  id      : number;
  action  : string;
  payload?: Record<string, unknown>;
}

interface SevenZipCommandResult {
  exitCode: number;
  stdout  : string;
  stderr  : string;
}

interface SevenZipStat {
  mode : number;
  size : number;
  mtime: number;
}

interface SevenZipWorkerOptions {
  workerUrl?: string;
  onLog?    : (payload: WorkerLogMessage["payload"]) => void;
}


// Worker is pre-built to public/assets/7z-worker.js by copyWasmAssetsPlugin

/**
 * Create a 7-Zip worker-backed instance with async FS and callMain methods.
 */
export default async function create7ZipWorker(options: SevenZipWorkerOptions = {}) {
  const workerUrl = options.workerUrl || MANIFEST_7Z_WORKER_JS;
  const onLog = options.onLog;
  const worker = new Worker(workerUrl, { type: "module" });
  let requestId = 0;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>();

  /**
   * Narrow unknown worker payloads to log messages for safe access.
   */
  function isWorkerLogMessage(message: WorkerResponse | WorkerLogMessage): message is WorkerLogMessage {
    return "type" in message && message.type === "log";
  }

  /**
   * Narrow unknown worker payloads to response messages for safe access.
   */
  function isWorkerResponse(message: WorkerResponse | WorkerLogMessage): message is WorkerResponse {
    return "id" in message;
  }

  worker.addEventListener("message", function handleMessage(event: MessageEvent<WorkerResponse | WorkerLogMessage>) {
    const response = event.data;
    if (!response) return;
    if (isWorkerLogMessage(response)) {
      if (onLog) onLog(response.payload);
      return;
    }
    if (!isWorkerResponse(response) || typeof response.id !== "number") return;
    const entry = pending.get(response.id);
    if (!entry) return;
    pending.delete(response.id);
    if (response.ok) entry.resolve(response.result);
    else entry.reject(new Error(response.error || "7-Zip worker error"));
  });

  worker.addEventListener("error", function handleError(error) {
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
  });

  function callWorker(action: string, payload?: Record<string, unknown>, transfer: Transferable[] = []) {
    const id = requestId++;
    const request: WorkerRequest = { id, action, payload };
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage(request, transfer);
    });
  }

  const FS = {
    open: function open(path: string, flags: string) {
      return callWorker("fsOpen", { path, flags }) as Promise<number>;
    },
    write: function write(fd: number, data: Uint8Array, offset = 0, length = data.length, position?: number) {
      const copied = data.slice();
      return callWorker(
        "fsWrite",
        { fd, buffer: copied.buffer, offset, length, position },
        [copied.buffer]
      ) as Promise<number>;
    },
    close: function close(fd: number) {
      return callWorker("fsClose", { fd }) as Promise<void>;
    },
    writeFile: function writeFile(path: string, data: Uint8Array) {
      const copied = data.slice();
      return callWorker("fsWriteFile", { path, buffer: copied.buffer }, [copied.buffer]) as Promise<void>;
    },
    readFile: function readFile(path: string) {
      return callWorker("fsReadFile", { path }).then((buffer) => new Uint8Array(buffer as ArrayBuffer)) as Promise<Uint8Array>;
    },
    unlink: function unlink(path: string) {
      return callWorker("fsUnlink", { path }) as Promise<void>;
    },
    mkdir: function mkdir(path: string) {
      return callWorker("fsMkdir", { path }) as Promise<void>;
    },
    rmdir: function rmdir(path: string) {
      return callWorker("fsRmdir", { path }) as Promise<void>;
    },
    readdir: function readdir(path: string) {
      return callWorker("fsReaddir", { path }) as Promise<string[]>;
    },
    stat: function stat(path: string) {
      return callWorker("fsStat", { path }) as Promise<SevenZipStat>;
    },
  };

  return {
    FS,
    callMain: function callMain(args: string[]) {
      return callWorker("callMain", { args }) as Promise<SevenZipCommandResult>;
    },
    terminate: function terminate() { worker.terminate(); },
  };
}
