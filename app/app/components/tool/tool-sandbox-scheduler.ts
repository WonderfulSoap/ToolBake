import type { ToolSandbox } from "./tool-sandbox";

// Execution request submitted to the scheduler
interface ExecutionRequest {
  inputWidgets     : Record<string, unknown>;
  changedWidgetId  : string | undefined;
  uiUpdateCallback : (output: Record<string, unknown>) => void;
  onExecutionStart?: () => void;
  onEnd?           : (result?: unknown) => void;
  onError?         : (error: unknown) => void;
  // Promise resolvers to notify caller when execution completes
  resolve          : (result: Record<string, unknown> | undefined) => void;
  reject           : (error: unknown) => void;
}

// Scheduling strategy for handling concurrent commits
export type SchedulingStrategy =
  | "queue-all"      // Queue all tasks and execute them in order
  | "keep-latest";   // Keep only the first (executing) and last (latest) task

// Serial scheduler that queues execution requests and processes them one by one
export class ToolSandboxScheduler {
  private queue   : ExecutionRequest[] = [];
  private isProcessing = false;
  private strategy: SchedulingStrategy;

  constructor(
    private toolSandbox: ToolSandbox,
    strategy: SchedulingStrategy = "keep-latest"
  ) {
    this.strategy = strategy;
  }

  // Synchronously commit an execution request; returns a Promise that resolves when execution completes
  commit(
    inputWidgets: Record<string, unknown>,
    changedWidgetId: string | undefined,
    uiUpdateCallback: (output: Record<string, unknown>) => void,
    // Optional hooks for execution lifecycle, to let ui update status
    onExecutionStart?: () => void,
    onEnd?: (result?: unknown) => void,
    onError?: (error: unknown) => void,
  ): Promise<Record<string, unknown> | undefined> {
    return new Promise((resolve, reject) => {
      const newRequest: ExecutionRequest = {
        inputWidgets,
        changedWidgetId,
        uiUpdateCallback,
        onExecutionStart,
        onEnd,
        onError,
        resolve,
        reject,
      };

      // Apply scheduling strategy
      if (this.strategy === "keep-latest" && this.queue.length > 0) {
        // Discard all pending requests (not the one being executed)
        this.queue.length = 0;
      }

      this.queue.push(newRequest);

      // Trigger processing if not already running
      void this.processQueue();
    });
  }

  // Process queued requests serially
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return; // Already processing, no need to start again
    if (this.queue.length === 0) return; // Queue is empty

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift()!; // Take the first request

      try {
        console.log("ToolSandboxScheduler: Executing request", JSON.stringify(request));

        // Call onExecutionStart before execution
        request.onExecutionStart?.();

        const result = await this.toolSandbox.executeHandler(
          request.inputWidgets,
          request.changedWidgetId,
          request.uiUpdateCallback,
        );
        console.log("ToolSandboxScheduler: Execution completed", result);
        request.resolve(result);

        // Call onEnd after successful execution
        request.onEnd?.(result);
      } catch (error) {
        request.reject(error);

        // Call onError when execution fails
        request.onError?.(error);
      }
    }

    this.isProcessing = false;
  }

  // Clear all pending requests in the queue
  clearQueue(): void {
    this.queue = [];
  }

  // Check if there are pending requests
  hasPendingRequests(): boolean {
    return this.queue.length > 0 || this.isProcessing;
  }
}