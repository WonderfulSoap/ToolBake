import { useCallback, useEffect, useMemo, useRef, type CSSProperties, type RefObject } from "react";
import { type ToolUIWidget, ToolInputTypeUiComponentInfoConvertMap, type WidgetValueCollectorInf } from "~/components/input-widgets/input-types";
import { cn } from "~/lib/utils";
import type { Tool } from "~/entity/tool";
import { ToolSandbox } from "./tool-sandbox";
import { ToolSandboxScheduler } from "./tool-sandbox-scheduler";
import type { LogPanelHandle } from "./log-panel";
import type { ExecutionIndicatorHandle } from "./execution-indicator";
import type { PackageLoadingIndicatorHandle } from "./package-loading-indicator";
import type { ToolExecutionStatus } from "~/entity/tool-log";

interface ToolParametersProps {
  tool                      : Tool;
  uiWidgets                 : ToolUIWidget[][];
  onError                   : (message?: string) => void;
  logPanelRef               : RefObject<LogPanelHandle>;
  executionIndicatorRef     : RefObject<ExecutionIndicatorHandle>;
  packageLoadingIndicatorRef: RefObject<PackageLoadingIndicatorHandle>;
}

export function ToolUIArea({tool, uiWidgets, onError, logPanelRef, executionIndicatorRef, packageLoadingIndicatorRef }: ToolParametersProps) {

  console.log("[ToolUIArea] ToolUIArea rerenderd");
  const widgetValueCollectors = useRef<Record<string, RefObject<WidgetValueCollectorInf<any> | undefined>>>({});

  /**
   * Helper to set execution status on both LogPanel and ExecutionIndicator via refs.
   */
  const setExecutionStatus = useCallback((status: ToolExecutionStatus) => {
    logPanelRef.current?.setExecutionStatus(status);
    executionIndicatorRef.current?.setStatus(status);
  }, [logPanelRef, executionIndicatorRef]);

  // Initialize widgetValuesRef with default values from uiWidgets
  const widgetValuesRef = useRef<Record<string, unknown>>(
    uiWidgets.flat().reduce((acc, widget) => {
      acc[widget.id] = widget.props?.defaultValue;
      return acc;
    }, {} as Record<string, unknown>)
  );

  // in react strict mode, react will call useEffect(()=>{},[]) twice, so we need to use a ref to avoid running firstRunSandbox twice
  const firstRunExecutedRef = useRef(false);

  // Create hooked console to capture logs and send to LogPanel
  const hookedConsole = useMemo(() => {
    return {
      log: (...args: unknown[]) => {
        logPanelRef.current?.appendLog("log", ...args);
      },
      info: (...args: unknown[]) => {
        logPanelRef.current?.appendLog("info", ...args);
      },
      warn: (...args: unknown[]) => {
        logPanelRef.current?.appendLog("warn", ...args);
      },
      error: (...args: unknown[]) => {
        logPanelRef.current?.appendLog("error", ...args);
      },
      debug: (...args: unknown[]) => {
        logPanelRef.current?.appendLog("debug", ...args);
      },
    };
  }, []);

  const toolSandboxScheduler = useRef<ToolSandboxScheduler | undefined>(undefined);


  useEffect(() =>{
    console.log("ToolSandboxScheduler: start create new scheduler");

    // Create new scheduler with hooked console
    if (toolSandboxScheduler.current){
      console.log(`ToolSandboxScheduler: scheduler already created, skip create: ${toolSandboxScheduler.current}`);
    }else{
      console.log("ToolSandboxScheduler: tool is empty, now create new scheduler");
      toolSandboxScheduler.current = new ToolSandboxScheduler(
        new ToolSandbox(
          tool,
          { console: hookedConsole },
          {
            onStart: (pkg: string) => {
              console.log(`ToolSandboxScheduler: requirePackage: ${pkg} start`);
              packageLoadingIndicatorRef.current?.addPackage(pkg);
            },
            onEnd: (pkg: string, error?: unknown) => {
              console.log(`ToolSandboxScheduler: requirePackage: ${pkg} end`, error ? `error: ${error}` : "");
              packageLoadingIndicatorRef.current?.removePackage(pkg);
            },
          })
      );
    }

  }, []);

  /**
   * Update widget values via setValue (without triggering onChange).
   * This directly calls each widget's setValue method to update UI without causing ToolUIArea re-render.
   */
  const updateWidgetValues = useCallback((values: Record<string, unknown>) => {
    for (const [widgetId, value] of Object.entries(values)) {
      // Update ref for getValue() consistency
      widgetValuesRef.current[widgetId] = value;
      // Call setValue on widget to update UI without triggering onChange
      const collectorRef = widgetValueCollectors.current[widgetId];
      if (collectorRef?.current?.setValue) {
        collectorRef.current.setValue(value);
        console.log(`[updateWidgetValues] setValue called for widget: ${widgetId}, value: ${JSON.stringify(value)}`);
      }
    }
  }, []);

  const collectValuesFromWdigets = useCallback(() =>{
    const collectedValues: Record<string, unknown> = {};
    for (const [widgetId, widgetValueCollectorRef] of Object.entries(widgetValueCollectors.current)) {
      console.log(`[collectValuesFromWdigets] now to collect widget value: ${widgetId}, widgetValueCollectorRef: ${widgetValueCollectorRef}`);
      const collectedValue = widgetValueCollectorRef.current?.getValue();
      console.log(`[collectValuesFromWdigets] collect widget value: widgetId: ${widgetId}, collectedValue: ${JSON.stringify(collectedValue)}`);
      collectedValues[widgetId] = collectedValue;
    }
    console.log(`[collectValuesFromWdigets] final values: ${JSON.stringify(collectedValues)}`);
    return collectedValues;
  }, []);

  // Recreate scheduler when tool changes, and run it once
  useEffect(() => {
    // Clear logs when tool changes
    logPanelRef.current?.clearLogs();

    // Initialize widget values from defaultValue via setValue
    // widgetValuesRef already collected defaultValues during initialization
    updateWidgetValues(widgetValuesRef.current);

    // Run sandbox for the first time
    const firstRunSandbox = async () => {
      if (firstRunExecutedRef.current) return;
      firstRunExecutedRef.current = true;
      console.log("[firstRunSandbox] first run tool sandbox");

      const values = collectValuesFromWdigets();
      const result = await toolSandboxScheduler.current?.commit(
        values,
        undefined,
        (callbackResult) => {
          // Update widget values via setValue (without re-render)
          updateWidgetValues(callbackResult as Record<string, unknown>);
          console.log(`[firstRunSandbox] uiUpdateCallback: ${JSON.stringify(callbackResult)}`);
        },
        () => {
          // onExecutionStart: Set execution status to running before execution
          logPanelRef.current?.clearLogs();
          setExecutionStatus("running");
          logPanelRef.current?.appendLog("log", "firstRunSandbox: running");
          logPanelRef.current?.appendLog("log", "widgetValues: ", JSON.stringify(values));
          logPanelRef.current?.appendLog("log", "changedWidgetId: undefined");
        },
        (result?: unknown) => {
          // onEnd: Set execution status to success after execution
          logPanelRef.current?.appendLog("log", "first run handler result: ", JSON.stringify(result));
          logPanelRef.current?.appendLog("log", "first run handler end");
          setExecutionStatus("success");
        },
        (error: unknown) => {
          // onError: Output error to console and logPanel, then set execution status
          const errorMessage = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
          console.error("[firstRunSandbox] error:", error);
          logPanelRef.current?.appendLog("error", `Execution failed: ${errorMessage}`);
          setExecutionStatus("error");
        }
      );
      console.log(`[firstRunSandbox] sandbox result: ${JSON.stringify(result)}`);

      // Update widget values based on handler return value via setValue
      if (result && typeof result === "object") {
        updateWidgetValues(result as Record<string, unknown>);
      }
    };
    void firstRunSandbox();
  }, [tool, hookedConsole, collectValuesFromWdigets, updateWidgetValues, setExecutionStatus]);


  // when widget value changed, collect all widgets values and run sandbox
  const onWidgetValueChange = useCallback((id: string, newValue: unknown) => {
    console.log(`[onWidgetValueChange] id: ${id}, newValue: ${JSON.stringify(newValue)}`);

    // call widgetValueCollectors to collect values
    const collectedValues = collectValuesFromWdigets();

    // run sandbox
    void (
      async () =>{
        const result = await toolSandboxScheduler.current?.commit(
          collectedValues,
          id,
          (callbackResult) => {
            // Update widget values via setValue (without re-render)
            updateWidgetValues(callbackResult as Record<string, unknown>);
            console.log(`[onWidgetValueChange] handler callback called, value: ${JSON.stringify(callbackResult)}`);
          },
          () => {
            logPanelRef.current?.clearLogs();
            // onExecutionStart: Set execution status to running before execution
            setExecutionStatus("running");
            logPanelRef.current?.appendLog("log", "handler running");
            logPanelRef.current?.appendLog("log", "widgetValues: ", JSON.stringify(collectedValues));
            logPanelRef.current?.appendLog("log", "changedWidgetId:", id);
          },
          (result?: unknown) => {
          // onEnd: Set execution status to success after execution
            logPanelRef.current?.appendLog("log", "handler result: ", JSON.stringify(result));
            setExecutionStatus("success");
          },
          (error: unknown) => {
            // onError: Output error to console and logPanel, then set execution status
            const errorMessage = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
            console.error("[onWidgetValueChange] error:", error);
            logPanelRef.current?.appendLog("error", `Execution failed: ${errorMessage}`);
            setExecutionStatus("error");
          }
        );
        console.log(`[onWidgetValueChange] sandbox result: ${JSON.stringify(result)}`);

        // Update widget values based on handler return value via setValue
        if (result && typeof result === "object") {
          updateWidgetValues(result as Record<string, unknown>);
        }

        console.log(`[onWidgetValueChange] handler finished, widgetValuesRef: ${JSON.stringify(widgetValuesRef.current)}`);
      }
    )();
  }, [logPanelRef, collectValuesFromWdigets, updateWidgetValues, setExecutionStatus]);

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden mb-6">
      <div className="px-4 py-2.5 border-b border-border flex justify-between items-center bg-card/50">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Parameters
        </span>
      </div>
      <div className="p-5 flex flex-col">
        {uiWidgets.map((row, rowIndex) => {
          const rowWidgets = row;
          const rowKey = rowWidgets.map(({ id }) => id).join("|") || `row-${rowIndex}`;
          const isMultiColumnRow = rowWidgets.length > 1;
          const hasCustomWidth = rowWidgets.some((widget) => widget.props?.width);
          // Mobile-first: multi-column rows stack into multiple lines on small screens.
          const rowClassName = cn(isMultiColumnRow && (hasCustomWidth
            ? "flex flex-wrap gap-5 items-start sm:flex-nowrap"
            : "grid gap-5 items-start grid-cols-1 sm:[grid-template-columns:repeat(var(--columns),minmax(0,1fr))]"));
          const rowStyle = isMultiColumnRow && !hasCustomWidth
            ? ({ "--columns": rowWidgets.length } as CSSProperties)
            : undefined;
          const gapAbove = getRowGapAbove(uiWidgets, rowIndex);
          return (
            <div key={rowKey} className={rowClassName} style={{ ...(rowStyle ?? {}), ...(gapAbove ? { marginTop: `${gapAbove}px` } : {}) }}>
              {rowWidgets.map((widget) => {
                const widgetID = widget.id;
                const widgetValueCollectorRef = useRef<WidgetValueCollectorInf<any>>(undefined);
                widgetValueCollectors.current[widgetID] = widgetValueCollectorRef;

                return useMemo(() => <ToolWidget
                  key={`${widget.type}-${widget.id}`}
                  widget={widget}
                  onWidgetValueChange={onWidgetValueChange}
                  widgetValueCollectorRef={widgetValueCollectorRef}
                />, [widget]);
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}


function ToolWidget(props: {
  widget                 : ToolUIWidget;
  onWidgetValueChange    : (id: string, value: unknown) => void;
  widgetValueCollectorRef: RefObject<WidgetValueCollectorInf<any> | undefined>;
}) {
  const { widget, onWidgetValueChange, widgetValueCollectorRef } = props;

  const widgetComponentFactory = ToolInputTypeUiComponentInfoConvertMap[widget.type];
  if (!widgetComponentFactory) {
    throw new Error(`[ToolWidget] Unknown input component type: ${widget.type}`);
  }

  return <>{widgetComponentFactory.uiComponentFactory(
    widget.id,
    widget.title,
    widget.mode,
    onWidgetValueChange,
    widgetValueCollectorRef,
    widget.props,
  )}</>;
}

function getDividerRowGapPx(row: ToolUIWidget[], kind: "before" | "after") {
  if (row.length !== 1) return null;
  const descriptor = row[0];
  if (descriptor.type !== "DividerInput") return null;
  const props = (descriptor.props ?? {}) as Record<string, unknown>;
  const gap = typeof props.gap === "number" ? props.gap : null;
  const gapBefore = typeof props.gapBefore === "number" ? props.gapBefore : null;
  const gapAfter = typeof props.gapAfter === "number" ? props.gapAfter : null;
  const defaultDividerGapPx = 8;
  if (kind === "before") return gapBefore ?? gap ?? defaultDividerGapPx;
  return gapAfter ?? gap ?? defaultDividerGapPx;
}

function getRowGapAbove(rows: ToolUIWidget[][], rowIndex: number) {
  if (rowIndex === 0) return 0;
  const defaultGapPx = 20;
  const currentBefore = getDividerRowGapPx(rows[rowIndex] ?? [], "before");
  const prevAfter = getDividerRowGapPx(rows[rowIndex - 1] ?? [], "after");
  return currentBefore ?? prevAfter ?? defaultGapPx;
}
