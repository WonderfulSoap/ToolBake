import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToolSandboxScheduler } from "./tool-sandbox-scheduler";
import type { ToolSandbox } from "./tool-sandbox";

describe("ToolSandboxScheduler - queue-all strategy", () => {
  let mockToolSandbox: ToolSandbox;
  let scheduler: ToolSandboxScheduler;
  let executionOrder: number[];
  let executionDelays: Map<number, number>;

  beforeEach(() => {
    executionOrder = [];
    executionDelays = new Map();

    // Mock ToolSandbox with configurable execution delays
    mockToolSandbox = {
      executeHandler: vi.fn(async (inputWidgets: Record<string, unknown>) => {
        const taskId = inputWidgets.taskId as number;
        const delay = executionDelays.get(taskId) || 10;

        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, delay));

        executionOrder.push(taskId);
        return { result: `task-${taskId}-completed` };
      }),
    } as unknown as ToolSandbox;

    scheduler = new ToolSandboxScheduler(mockToolSandbox, "queue-all");
  });

  it("should execute a single task", async () => {
    const result = await scheduler.commit(
      { taskId: 1 },
      undefined,
      vi.fn()
    );

    expect(result).toEqual({ result: "task-1-completed" });
    expect(executionOrder).toEqual([1]);
    expect(mockToolSandbox.executeHandler).toHaveBeenCalledTimes(1);
  });

  it("should execute multiple tasks sequentially in order", async () => {
    const promise1 = scheduler.commit({ taskId: 1 }, undefined, vi.fn());
    const promise2 = scheduler.commit({ taskId: 2 }, undefined, vi.fn());
    const promise3 = scheduler.commit({ taskId: 3 }, undefined, vi.fn());

    await Promise.all([promise1, promise2, promise3]);

    expect(executionOrder).toEqual([1, 2, 3]);
    expect(mockToolSandbox.executeHandler).toHaveBeenCalledTimes(3);
  });

  it("should handle tasks with different execution times", async () => {
    // Task 1 takes 50ms, task 2 takes 10ms, task 3 takes 30ms
    executionDelays.set(1, 50);
    executionDelays.set(2, 10);
    executionDelays.set(3, 30);

    const promise1 = scheduler.commit({ taskId: 1 }, undefined, vi.fn());
    const promise2 = scheduler.commit({ taskId: 2 }, undefined, vi.fn());
    const promise3 = scheduler.commit({ taskId: 3 }, undefined, vi.fn());

    await Promise.all([promise1, promise2, promise3]);

    // Should still execute in submission order, not by duration
    expect(executionOrder).toEqual([1, 2, 3]);
  });

  it("should pass correct parameters to executeHandler", async () => {
    const inputWidgets = { taskId: 1, input: "test" };
    const changedWidgetId = "widget-1";
    const uiCallback = vi.fn();

    await scheduler.commit(
      inputWidgets,
      changedWidgetId,
      uiCallback
    );

    expect(mockToolSandbox.executeHandler).toHaveBeenCalledWith(
      inputWidgets,
      changedWidgetId,
      uiCallback
    );
  });

  it("should handle task execution errors and continue with remaining tasks", async () => {
    // Mock executeHandler to fail on task 2
    mockToolSandbox.executeHandler = vi.fn(async (inputWidgets: Record<string, unknown>) => {
      const taskId = inputWidgets.taskId as number;
      await new Promise(resolve => setTimeout(resolve, 10));

      if (taskId === 2) {
        throw new Error("Task 2 failed");
      }

      executionOrder.push(taskId);
      return { result: `task-${taskId}-completed` };
    });

    const promise1 = scheduler.commit({ taskId: 1 }, undefined, vi.fn());
    const promise2 = scheduler.commit({ taskId: 2 }, undefined, vi.fn());
    const promise3 = scheduler.commit({ taskId: 3 }, undefined, vi.fn());

    const results = await Promise.allSettled([promise1, promise2, promise3]);

    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("rejected");
    expect(results[2].status).toBe("fulfilled");

    if (results[1].status === "rejected") {
      expect(results[1].reason.message).toBe("Task 2 failed");
    }

    expect(executionOrder).toEqual([1, 3]);
    expect(mockToolSandbox.executeHandler).toHaveBeenCalledTimes(3);
  });

  it("should not execute tasks concurrently", async () => {
    const executionTimestamps: Array<{ taskId: number; start: number; end: number }> = [];

    mockToolSandbox.executeHandler = vi.fn(async (inputWidgets: Record<string, unknown>) => {
      const taskId = inputWidgets.taskId as number;
      const start = Date.now();

      await new Promise(resolve => setTimeout(resolve, 20));

      const end = Date.now();
      executionTimestamps.push({ taskId, start, end });
      executionOrder.push(taskId);

      return { result: `task-${taskId}-completed` };
    });

    const promise1 = scheduler.commit({ taskId: 1 }, undefined, vi.fn());
    const promise2 = scheduler.commit({ taskId: 2 }, undefined, vi.fn());
    const promise3 = scheduler.commit({ taskId: 3 }, undefined, vi.fn());

    await Promise.all([promise1, promise2, promise3]);

    // Verify that each task starts after the previous one ends
    for (let i = 1; i < executionTimestamps.length; i++) {
      const prevTask = executionTimestamps[i - 1];
      const currentTask = executionTimestamps[i];

      expect(currentTask.start).toBeGreaterThanOrEqual(prevTask.end);
    }
  });

  it("should handle rapid concurrent commits", async () => {
    const promises = [];

    for (let i = 1; i <= 10; i++) {
      promises.push(scheduler.commit({ taskId: i }, undefined, vi.fn()));
    }

    await Promise.all(promises);

    expect(executionOrder).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(mockToolSandbox.executeHandler).toHaveBeenCalledTimes(10);
  });

  it("should respect hasPendingRequests state", async () => {
    executionDelays.set(1, 50);

    expect(scheduler.hasPendingRequests()).toBe(false);

    const promise1 = scheduler.commit({ taskId: 1 }, undefined, vi.fn());

    // Should be processing now
    expect(scheduler.hasPendingRequests()).toBe(true);

    const promise2 = scheduler.commit({ taskId: 2 }, undefined, vi.fn());

    // Still processing
    expect(scheduler.hasPendingRequests()).toBe(true);

    await Promise.all([promise1, promise2]);

    // All done
    expect(scheduler.hasPendingRequests()).toBe(false);
  });

  it("should allow clearQueue to remove pending tasks", async () => {
    executionDelays.set(1, 50);

    const promise1 = scheduler.commit({ taskId: 1 }, undefined, vi.fn());
    void scheduler.commit({ taskId: 2 }, undefined, vi.fn());
    void scheduler.commit({ taskId: 3 }, undefined, vi.fn());

    // Clear queue while task 1 is executing
    await new Promise(resolve => setTimeout(resolve, 10));
    scheduler.clearQueue();

    await promise1;

    // Only task 1 should have executed
    expect(executionOrder).toEqual([1]);
    expect(mockToolSandbox.executeHandler).toHaveBeenCalledTimes(1);
  });

  it("should call onExecutionStart, onEnd callbacks correctly", async () => {
    const onExecutionStart = vi.fn();
    const onEnd = vi.fn();
    const onError = vi.fn();

    await scheduler.commit(
      { taskId: 1 },
      undefined,
      vi.fn(),
      onExecutionStart,
      onEnd,
      onError
    );

    expect(onExecutionStart).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("should call onError callback when execution fails", async () => {
    mockToolSandbox.executeHandler = vi.fn(async () => {
      throw new Error("Execution failed");
    });

    const onExecutionStart = vi.fn();
    const onEnd = vi.fn();
    const onError = vi.fn();

    await scheduler.commit(
      { taskId: 1 },
      undefined,
      vi.fn(),
      onExecutionStart,
      onEnd,
      onError
    ).catch(() => {});

    expect(onExecutionStart).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({
      message: "Execution failed"
    }));
  });

  it("should call onExecutionStart before handler execution and onEnd after", async () => {
    const callOrder: string[] = [];

    mockToolSandbox.executeHandler = vi.fn(async () => {
      callOrder.push("handler");
      await new Promise(resolve => setTimeout(resolve, 10));
      return { result: "completed" };
    });

    await scheduler.commit(
      { taskId: 1 },
      undefined,
      vi.fn(),
      () => callOrder.push("onStart"),
      () => callOrder.push("onEnd"),
      () => callOrder.push("onError")
    );

    expect(callOrder).toEqual(["onStart", "handler", "onEnd"]);
  });

  it("should handle multiple tasks with lifecycle callbacks", async () => {
    const task1Callbacks = {
      onStart: vi.fn(),
      onEnd  : vi.fn(),
      onError: vi.fn(),
    };

    const task2Callbacks = {
      onStart: vi.fn(),
      onEnd  : vi.fn(),
      onError: vi.fn(),
    };

    const promise1 = scheduler.commit(
      { taskId: 1 },
      undefined,
      vi.fn(),
      task1Callbacks.onStart,
      task1Callbacks.onEnd,
      task1Callbacks.onError
    );

    const promise2 = scheduler.commit(
      { taskId: 2 },
      undefined,
      vi.fn(),
      task2Callbacks.onStart,
      task2Callbacks.onEnd,
      task2Callbacks.onError
    );

    await Promise.all([promise1, promise2]);

    // Both tasks should have their lifecycle callbacks called
    expect(task1Callbacks.onStart).toHaveBeenCalledTimes(1);
    expect(task1Callbacks.onEnd).toHaveBeenCalledTimes(1);
    expect(task1Callbacks.onError).not.toHaveBeenCalled();

    expect(task2Callbacks.onStart).toHaveBeenCalledTimes(1);
    expect(task2Callbacks.onEnd).toHaveBeenCalledTimes(1);
    expect(task2Callbacks.onError).not.toHaveBeenCalled();
  });
});

describe("ToolSandboxScheduler - keep-latest strategy", () => {
  let mockToolSandbox: ToolSandbox;
  let scheduler: ToolSandboxScheduler;
  let executionOrder: number[];
  let executionDelays: Map<number, number>;

  beforeEach(() => {
    executionOrder = [];
    executionDelays = new Map();

    // Mock ToolSandbox with configurable execution delays
    mockToolSandbox = {
      executeHandler: vi.fn(async (inputWidgets: Record<string, unknown>) => {
        const taskId = inputWidgets.taskId as number;
        const delay = executionDelays.get(taskId) || 10;

        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, delay));

        executionOrder.push(taskId);
        return { result: `task-${taskId}-completed` };
      }),
    } as unknown as ToolSandbox;

    scheduler = new ToolSandboxScheduler(mockToolSandbox, "keep-latest");
  });

  it("should execute a single task", async () => {
    const result = await scheduler.commit(
      { taskId: 1 },
      undefined,
      vi.fn()
    );

    expect(result).toEqual({ result: "task-1-completed" });
    expect(executionOrder).toEqual([1]);
    expect(mockToolSandbox.executeHandler).toHaveBeenCalledTimes(1);
  });

  it("should only execute first and last task when multiple are submitted rapidly", async () => {
    executionDelays.set(1, 50); // Make task 1 slow to allow other commits

    const promise1 = scheduler.commit({ taskId: 1 }, undefined, vi.fn());
    void scheduler.commit({ taskId: 2 }, undefined, vi.fn()); // Discarded
    void scheduler.commit({ taskId: 3 }, undefined, vi.fn()); // Discarded
    const promise4 = scheduler.commit({ taskId: 4 }, undefined, vi.fn());

    // Wait for all to settle (promise2 and promise3 will never resolve/reject)
    await promise1;
    await promise4;

    // Only task 1 (executing) and task 4 (last) should execute
    expect(executionOrder).toEqual([1, 4]);
    expect(mockToolSandbox.executeHandler).toHaveBeenCalledTimes(2);
  });

  it("should handle scenario: commit1 executing, commit2 waiting, commit3 arrives", async () => {
    executionDelays.set(1, 50);

    const promise1 = scheduler.commit({ taskId: 1 }, undefined, vi.fn());

    // Wait a bit to ensure task 1 is executing
    await new Promise(resolve => setTimeout(resolve, 10));

    void scheduler.commit({ taskId: 2 }, undefined, vi.fn()); // Discarded

    // Wait a bit, then submit task 3
    await new Promise(resolve => setTimeout(resolve, 10));

    const promise3 = scheduler.commit({ taskId: 3 }, undefined, vi.fn());

    await promise1;
    await promise3;

    // Task 2 should be discarded, only 1 and 3 execute
    expect(executionOrder).toEqual([1, 3]);
    expect(mockToolSandbox.executeHandler).toHaveBeenCalledTimes(2);
  });

  it("should handle many rapid commits and only keep first and last", async () => {
    executionDelays.set(1, 80);

    const promises = [];
    for (let i = 1; i <= 10; i++) {
      promises.push(scheduler.commit({ taskId: i }, undefined, vi.fn()));
    }

    // Wait for first and last
    await promises[0];
    await promises[9];

    // Only task 1 and task 10 should execute
    expect(executionOrder).toEqual([1, 10]);
    expect(mockToolSandbox.executeHandler).toHaveBeenCalledTimes(2);
  });

  it("should handle commits after first task completes", async () => {
    executionDelays.set(1, 30);
    executionDelays.set(2, 30);

    const promise1 = scheduler.commit({ taskId: 1 }, undefined, vi.fn());

    await promise1; // Wait for task 1 to complete

    // Now submit more tasks
    const promise2 = scheduler.commit({ taskId: 2 }, undefined, vi.fn());
    void scheduler.commit({ taskId: 3 }, undefined, vi.fn()); // Discarded
    const promise4 = scheduler.commit({ taskId: 4 }, undefined, vi.fn());

    await promise2;
    await promise4;

    // Task 1 executes, then task 2 starts, task 3 is discarded, task 4 executes
    expect(executionOrder).toEqual([1, 2, 4]);
    expect(mockToolSandbox.executeHandler).toHaveBeenCalledTimes(3);
  });

  it("discarded tasks should have promises that never resolve or reject", async () => {
    executionDelays.set(1, 50);

    const promise1 = scheduler.commit({ taskId: 1 }, undefined, vi.fn());
    const promise2 = scheduler.commit({ taskId: 2 }, undefined, vi.fn());
    const promise3 = scheduler.commit({ taskId: 3 }, undefined, vi.fn());

    await promise1;
    await promise3;

    // promise2 should still be pending
    const promise2Status = await Promise.race([
      promise2.then(() => "resolved"),
      Promise.resolve("pending")
    ]);

    expect(promise2Status).toBe("pending");
    expect(executionOrder).toEqual([1, 3]);
  });

  it("should handle errors in executing task and still process latest", async () => {
    mockToolSandbox.executeHandler = vi.fn(async (inputWidgets: Record<string, unknown>) => {
      const taskId = inputWidgets.taskId as number;
      const delay = executionDelays.get(taskId) || 10;

      await new Promise(resolve => setTimeout(resolve, delay));

      if (taskId === 1) {
        throw new Error("Task 1 failed");
      }

      executionOrder.push(taskId);
      return { result: `task-${taskId}-completed` };
    });

    executionDelays.set(1, 50);

    const promise1 = scheduler.commit({ taskId: 1 }, undefined, vi.fn());
    void scheduler.commit({ taskId: 2 }, undefined, vi.fn()); // Discarded
    const promise3 = scheduler.commit({ taskId: 3 }, undefined, vi.fn());

    const results = await Promise.allSettled([promise1, promise3]);

    expect(results[0].status).toBe("rejected");
    expect(results[1].status).toBe("fulfilled");

    // Task 1 failed, task 2 discarded, task 3 executed
    expect(executionOrder).toEqual([3]);
    expect(mockToolSandbox.executeHandler).toHaveBeenCalledTimes(2);
  });

  it("should work correctly when queue is empty on new commit", async () => {
    const promise1 = scheduler.commit({ taskId: 1 }, undefined, vi.fn());
    await promise1;

    // Queue is now empty, submit new task
    const promise2 = scheduler.commit({ taskId: 2 }, undefined, vi.fn());
    await promise2;

    expect(executionOrder).toEqual([1, 2]);
    expect(mockToolSandbox.executeHandler).toHaveBeenCalledTimes(2);
  });

  it("should respect hasPendingRequests with keep-latest strategy", async () => {
    executionDelays.set(1, 50);

    expect(scheduler.hasPendingRequests()).toBe(false);

    const promise1 = scheduler.commit({ taskId: 1 }, undefined, vi.fn());

    expect(scheduler.hasPendingRequests()).toBe(true);

    void scheduler.commit({ taskId: 2 }, undefined, vi.fn());
    const promise3 = scheduler.commit({ taskId: 3 }, undefined, vi.fn());

    expect(scheduler.hasPendingRequests()).toBe(true);

    await promise1;
    await promise3;

    expect(scheduler.hasPendingRequests()).toBe(false);
  });

  it("should handle clearQueue with keep-latest strategy", async () => {
    executionDelays.set(1, 50);

    const promise1 = scheduler.commit({ taskId: 1 }, undefined, vi.fn());
    void scheduler.commit({ taskId: 2 }, undefined, vi.fn());
    void scheduler.commit({ taskId: 3 }, undefined, vi.fn());

    // Clear queue while task 1 is executing
    await new Promise(resolve => setTimeout(resolve, 10));
    scheduler.clearQueue();

    await promise1;

    // Only task 1 should have executed
    expect(executionOrder).toEqual([1]);
    expect(mockToolSandbox.executeHandler).toHaveBeenCalledTimes(1);
  });

  it("should pass correct parameters for the latest task", async () => {
    executionDelays.set(1, 50);

    const inputWidgets1 = { taskId: 1, input: "first" };
    const inputWidgets2 = { taskId: 2, input: "second" };
    const inputWidgets3 = { taskId: 3, input: "third" };

    const changedWidgetId1 = "widget-1";
    const changedWidgetId3 = "widget-3";

    const uiCallback1 = vi.fn();
    const uiCallback3 = vi.fn();

    const promise1 = scheduler.commit(inputWidgets1, changedWidgetId1, uiCallback1);
    void scheduler.commit(inputWidgets2, undefined, vi.fn());
    const promise3 = scheduler.commit(inputWidgets3, changedWidgetId3, uiCallback3);

    await promise1;
    await promise3;

    // Verify task 1 parameters
    expect(mockToolSandbox.executeHandler).toHaveBeenNthCalledWith(
      1,
      inputWidgets1,
      changedWidgetId1,
      uiCallback1
    );

    // Verify task 3 parameters
    expect(mockToolSandbox.executeHandler).toHaveBeenNthCalledWith(
      2,
      inputWidgets3,
      changedWidgetId3,
      uiCallback3
    );
  });

  it("should call lifecycle callbacks for executed tasks only (not discarded)", async () => {
    executionDelays.set(1, 50);

    const task1Callbacks = {
      onStart: vi.fn(),
      onEnd  : vi.fn(),
      onError: vi.fn(),
    };

    const task2Callbacks = {
      onStart: vi.fn(),
      onEnd  : vi.fn(),
      onError: vi.fn(),
    };

    const task3Callbacks = {
      onStart: vi.fn(),
      onEnd  : vi.fn(),
      onError: vi.fn(),
    };

    const promise1 = scheduler.commit(
      { taskId: 1 },
      undefined,
      vi.fn(),
      task1Callbacks.onStart,
      task1Callbacks.onEnd,
      task1Callbacks.onError
    );

    void scheduler.commit(
      { taskId: 2 },
      undefined,
      vi.fn(),
      task2Callbacks.onStart,
      task2Callbacks.onEnd,
      task2Callbacks.onError
    ); // This will be discarded

    const promise3 = scheduler.commit(
      { taskId: 3 },
      undefined,
      vi.fn(),
      task3Callbacks.onStart,
      task3Callbacks.onEnd,
      task3Callbacks.onError
    );

    await promise1;
    await promise3;

    // Task 1 and 3 should have callbacks called
    expect(task1Callbacks.onStart).toHaveBeenCalledTimes(1);
    expect(task1Callbacks.onEnd).toHaveBeenCalledTimes(1);
    expect(task1Callbacks.onError).not.toHaveBeenCalled();

    expect(task3Callbacks.onStart).toHaveBeenCalledTimes(1);
    expect(task3Callbacks.onEnd).toHaveBeenCalledTimes(1);
    expect(task3Callbacks.onError).not.toHaveBeenCalled();

    // Task 2 was discarded, so no callbacks should be called
    expect(task2Callbacks.onStart).not.toHaveBeenCalled();
    expect(task2Callbacks.onEnd).not.toHaveBeenCalled();
    expect(task2Callbacks.onError).not.toHaveBeenCalled();
  });

  it("should call onError for failed task in keep-latest mode", async () => {
    mockToolSandbox.executeHandler = vi.fn(async (inputWidgets: Record<string, unknown>) => {
      const taskId = inputWidgets.taskId as number;
      await new Promise(resolve => setTimeout(resolve, 10));

      if (taskId === 1) {
        throw new Error("Task 1 failed");
      }

      return { result: `task-${taskId}-completed` };
    });

    executionDelays.set(1, 50);

    const task1Callbacks = {
      onStart: vi.fn(),
      onEnd  : vi.fn(),
      onError: vi.fn(),
    };

    const task3Callbacks = {
      onStart: vi.fn(),
      onEnd  : vi.fn(),
      onError: vi.fn(),
    };

    const promise1 = scheduler.commit(
      { taskId: 1 },
      undefined,
      vi.fn(),
      task1Callbacks.onStart,
      task1Callbacks.onEnd,
      task1Callbacks.onError
    );

    void scheduler.commit({ taskId: 2 }, undefined, vi.fn());

    const promise3 = scheduler.commit(
      { taskId: 3 },
      undefined,
      vi.fn(),
      task3Callbacks.onStart,
      task3Callbacks.onEnd,
      task3Callbacks.onError
    );

    const results = await Promise.allSettled([promise1, promise3]);

    expect(results[0].status).toBe("rejected");
    expect(results[1].status).toBe("fulfilled");

    // Task 1 should have called onStart and onError
    expect(task1Callbacks.onStart).toHaveBeenCalledTimes(1);
    expect(task1Callbacks.onEnd).not.toHaveBeenCalled();
    expect(task1Callbacks.onError).toHaveBeenCalledTimes(1);
    expect(task1Callbacks.onError).toHaveBeenCalledWith(expect.objectContaining({
      message: "Task 1 failed"
    }));

    // Task 3 should have succeeded
    expect(task3Callbacks.onStart).toHaveBeenCalledTimes(1);
    expect(task3Callbacks.onEnd).toHaveBeenCalledTimes(1);
    expect(task3Callbacks.onError).not.toHaveBeenCalled();
  });

  it("should call callbacks in correct order with keep-latest strategy", async () => {
    executionDelays.set(1, 50);

    const callOrder: string[] = [];

    mockToolSandbox.executeHandler = vi.fn(async (inputWidgets: Record<string, unknown>) => {
      const taskId = inputWidgets.taskId as number;
      callOrder.push(`handler-${taskId}`);
      await new Promise(resolve => setTimeout(resolve, executionDelays.get(taskId) || 10));
      return { result: `task-${taskId}-completed` };
    });

    const promise1 = scheduler.commit(
      { taskId: 1 },
      undefined,
      vi.fn(),
      () => callOrder.push("onStart-1"),
      () => callOrder.push("onEnd-1"),
      () => callOrder.push("onError-1")
    );

    void scheduler.commit({ taskId: 2 }, undefined, vi.fn()); // Discarded

    const promise3 = scheduler.commit(
      { taskId: 3 },
      undefined,
      vi.fn(),
      () => callOrder.push("onStart-3"),
      () => callOrder.push("onEnd-3"),
      () => callOrder.push("onError-3")
    );

    await promise1;
    await promise3;

    expect(callOrder).toEqual([
      "onStart-1",
      "handler-1",
      "onEnd-1",
      "onStart-3",
      "handler-3",
      "onEnd-3"
    ]);
  });
});
