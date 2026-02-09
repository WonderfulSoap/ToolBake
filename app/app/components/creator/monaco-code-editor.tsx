import { loadMonaco, getMonaco, type Monaco } from "~/lib/monaco-custom";
import type { IDisposable, IRange } from "monaco-editor";
import { useRef, useEffect, useMemo, useCallback, useState } from "react";
import { useThemeContext } from "~/contexts/theme-context";

interface MonacoCodeEditorProps {
  value?            : string;
  defaultLanguage?  : string;
  language?         : string;
  onChange?         : (value: string | undefined) => void;
  height?           : string | number;
  extraLibContent?  : string;
  extraLibPath?     : string;
  jsExtraLibContent?: string;
  jsExtraLibPath?   : string;
  onSave?           : () => void;
  readOnly?         : boolean;
}

const HANDLER_NAME_REGEX = /\bhandler\b/;

/**
 * Monaco Code Editor component using monaco-editor directly with vite-plugin-monaco-editor-esm.
 * Uses dynamic import to load monaco only on the client side, avoiding SSR issues.
 */
export function MonacoCodeEditor({
  value,
  defaultLanguage,
  language,
  onChange,
  height = "100%",
  extraLibContent,
  extraLibPath = "ts:tool-handler.d.ts",
  jsExtraLibContent,
  jsExtraLibPath = "ts:tool-global-script.js",
  onSave,
  readOnly = false,
}: MonacoCodeEditorProps) {
  const { theme } = useThemeContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const handlerDecorationsRef = useRef<string[]>([]);
  const decorationVersionRef = useRef(0);
  const extraLibDisposableRef = useRef<IDisposable | null>(null);
  const jsExtraLibDisposableRef = useRef<IDisposable | null>(null);
  const jsDefaultsConfiguredRef = useRef(false);
  const onSaveRef = useRef(onSave);
  const saveCommandRegisteredRef = useRef(false);
  const isUpdatingRef = useRef(false);
  const [isMonacoLoaded, setIsMonacoLoaded] = useState(() => getMonaco() !== null);

  const monacoTheme = useMemo(() => (theme === "dark" ? "vs-dark" : "vs"), [theme]);
  const effectiveLanguage = language ?? defaultLanguage ?? "javascript";

  // Keep onSave ref updated
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  // Load monaco on mount
  useEffect(() => {
    if (!isMonacoLoaded) {
      loadMonaco().then(() => setIsMonacoLoaded(true));
    }
  }, [isMonacoLoaded]);

  // Register Ctrl+S save shortcut
  const registerSaveShortcut = useCallback(() => {
    const monaco = getMonaco();
    const editor = editorRef.current;
    if (!monaco || !editor || saveCommandRegisteredRef.current || !onSaveRef.current) return;
    const commandId = editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSaveRef.current?.());
    if (commandId) saveCommandRegisteredRef.current = true;
  }, []);

  // Apply handler signature decorations for JavaScript files
  const applyHandlerSignatureDecorations = useCallback(async () => {
    const monaco = getMonaco();
    const editor = editorRef.current;
    if (!monaco || !editor) return;
    if (effectiveLanguage !== "javascript") {
      if (handlerDecorationsRef.current.length) {
        handlerDecorationsRef.current = editor.deltaDecorations(handlerDecorationsRef.current, []);
      }
      return;
    }
    const model = editor.getModel();
    if (!model) return;
    const version = ++decorationVersionRef.current;
    try {
      const ranges = await getTopLevelHandlerRanges(monaco, model);
      if (version !== decorationVersionRef.current) return;
      handlerDecorationsRef.current = editor.deltaDecorations(
        handlerDecorationsRef.current,
        ranges.map((range) => ({ range, options: { inlineClassName: "monaco-handler-signature" } }))
      );
    } catch (error) {
      if (handlerDecorationsRef.current.length) {
        handlerDecorationsRef.current = editor.deltaDecorations(handlerDecorationsRef.current, []);
      }
      console.warn("Failed to highlight handler signature", error);
    }
  }, [effectiveLanguage]);

  // Configure JavaScript language defaults for type checking
  const configureLanguageDefaults = useCallback(() => {
    const monaco = getMonaco();
    if (!monaco) return;
    if (effectiveLanguage !== "javascript" || jsDefaultsConfiguredRef.current) return;
    monaco.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation  : false,
    });
    monaco.typescript.javascriptDefaults.setCompilerOptions({
      target              : monaco.typescript.ScriptTarget.ES2017,
      allowNonTsExtensions: true,
      allowJs             : true,
      checkJs             : true,
      noEmit              : true,
    });
    jsDefaultsConfiguredRef.current = true;
  }, [effectiveLanguage]);

  // Apply extra lib for handler type definitions
  const applyHandlerExtraLib = useCallback(async () => {
    const monaco = getMonaco();
    const editor = editorRef.current;
    if (!monaco) return;
    const defaults = effectiveLanguage === "typescript"
      ? monaco.typescript.typescriptDefaults
      : monaco.typescript.javascriptDefaults;

    if (extraLibDisposableRef.current) {
      extraLibDisposableRef.current.dispose();
      extraLibDisposableRef.current = null;
    }
    if (!extraLibContent) return;

    extraLibDisposableRef.current = defaults.addExtraLib(extraLibContent, extraLibPath);
    const libUri = monaco.Uri.parse(extraLibPath);
    const existingModel = monaco.editor.getModel(libUri);
    if (existingModel) existingModel.setValue(extraLibContent);
    else monaco.editor.createModel(extraLibContent, "typescript", libUri);

    // Force Monaco to reload type definitions by triggering a type check
    if (editor && effectiveLanguage === "javascript") {
      const model = editor.getModel();
      if (model) {
        requestAnimationFrame(() => {
          const refreshDiagnostics = async () => {
            try {
              const workerGetter = await monaco.typescript.getJavaScriptWorker();
              const worker = await workerGetter(model.uri);
              await worker.getSemanticDiagnostics(model.uri.toString());
            } catch (error) {
              console.warn("Failed to trigger type check refresh", error);
            }
          };
          void refreshDiagnostics();
        });
      }
    }
  }, [extraLibContent, extraLibPath, effectiveLanguage]);

  // Apply extra lib for global script definitions
  const applyJsExtraLib = useCallback(() => {
    const monaco = getMonaco();
    if (!monaco || effectiveLanguage !== "javascript") return;
    if (jsExtraLibDisposableRef.current) {
      jsExtraLibDisposableRef.current.dispose();
      jsExtraLibDisposableRef.current = null;
    }
    const libUri = monaco.Uri.parse(jsExtraLibPath);
    if (!jsExtraLibContent || jsExtraLibContent.trim().length === 0) {
      const model = monaco.editor.getModel(libUri);
      if (model) model.dispose();
      return;
    }
    monaco.typescript.javascriptDefaults.addExtraLib(jsExtraLibContent, jsExtraLibPath);
    const model = monaco.editor.getModel(libUri);
    if (model) model.setValue(jsExtraLibContent);
    else monaco.editor.createModel(jsExtraLibContent, "javascript", libUri);
  }, [jsExtraLibContent, jsExtraLibPath, effectiveLanguage]);

  // Initialize editor when monaco is loaded
  useEffect(() => {
    const monaco = getMonaco();
    if (!monaco || !containerRef.current || !isMonacoLoaded) return;

    const editor = monaco.editor.create(containerRef.current, {
      value               : value ?? "",
      language            : effectiveLanguage,
      theme               : monacoTheme,
      fontSize            : 13,
      minimap             : { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout     : true,
      wordWrap            : "on",
      readOnly            : !!readOnly,
      domReadOnly         : !!readOnly,
      formatOnType        : false,
      formatOnPaste       : false,
    });

    editorRef.current = editor;
    saveCommandRegisteredRef.current = false;

    // Set up change listener
    const changeDisposable = editor.onDidChangeModelContent(() => {
      if (isUpdatingRef.current) return;
      const newValue = editor.getValue();
      onChange?.(newValue);
      void applyHandlerSignatureDecorations();
    });

    // Initial setup
    configureLanguageDefaults();
    void applyHandlerExtraLib();
    applyJsExtraLib();
    void applyHandlerSignatureDecorations();
    registerSaveShortcut();

    return () => {
      changeDisposable.dispose();
      if (extraLibDisposableRef.current) {
        extraLibDisposableRef.current.dispose();
        extraLibDisposableRef.current = null;
      }
      if (jsExtraLibDisposableRef.current) {
        jsExtraLibDisposableRef.current.dispose();
        jsExtraLibDisposableRef.current = null;
      }
      editor.dispose();
      editorRef.current = null;
      saveCommandRegisteredRef.current = false;
    };
  }, [isMonacoLoaded]); // Only run when monaco becomes available

  // Update theme when it changes
  useEffect(() => {
    const monaco = getMonaco();
    if (monaco) monaco.editor.setTheme(monacoTheme);
  }, [monacoTheme]);

  // Update value when prop changes (external update)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const currentValue = editor.getValue();
    if (value !== undefined && value !== currentValue) {
      isUpdatingRef.current = true;
      editor.setValue(value);
      isUpdatingRef.current = false;
    }
  }, [value]);

  // Update language when prop changes
  useEffect(() => {
    const monaco = getMonaco();
    const editor = editorRef.current;
    if (!monaco || !editor) return;
    const model = editor.getModel();
    if (model) monaco.editor.setModelLanguage(model, effectiveLanguage);
    configureLanguageDefaults();
    void applyHandlerExtraLib();
    applyJsExtraLib();
    void applyHandlerSignatureDecorations();
  }, [effectiveLanguage, configureLanguageDefaults, applyHandlerExtraLib, applyJsExtraLib, applyHandlerSignatureDecorations]);

  // Update extra libs when they change
  useEffect(() => {
    void applyHandlerExtraLib();
    applyJsExtraLib();
  }, [applyHandlerExtraLib, applyJsExtraLib]);

  // Register save shortcut when onSave changes
  useEffect(() => { registerSaveShortcut(); }, [registerSaveShortcut, onSave]);

  // Update readOnly when prop changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.updateOptions({ readOnly: !!readOnly, domReadOnly: !!readOnly });
  }, [readOnly]);

  const containerStyle = useMemo(() => ({
    height: typeof height === "number" ? `${height}px` : height,
    width : "100%",
  }), [height]);

  // Show loading placeholder while monaco is loading
  if (!isMonacoLoaded) {
    return (
      <div className="flex-1 min-w-0 w-full flex items-center justify-center bg-muted/30" style={containerStyle}>
        <span className="text-muted-foreground text-sm">Loading editor...</span>
      </div>
    );
  }

  return <div ref={containerRef} className="flex-1 min-w-0 w-full" style={containerStyle} />;
}

// Type for navigation tree node from TypeScript worker
type NavigationTreeNode = {
  kind       : string;
  text       : string;
  spans?     : Array<{ start: number; length: number }>;
  childItems?: NavigationTreeNode[];
};

/**
 * Get ranges of top-level handler function names for decoration.
 */
async function getTopLevelHandlerRanges(monaco: typeof Monaco, model: Monaco.editor.ITextModel): Promise<IRange[]> {
  const workerGetter = await monaco.typescript.getJavaScriptWorker();
  const worker = await workerGetter(model.uri);
  const navigationTree = await worker.getNavigationTree(model.uri.toString());
  if (!navigationTree?.childItems?.length) return [];
  const source = model.getValue();
  const ranges: IRange[] = [];
  navigationTree.childItems.forEach((node: NavigationTreeNode) => {
    if (node.kind !== "function" || node.text !== "handler" || !node.spans?.length) return;
    const span = node.spans[0];
    const handlerRange = resolveHandlerNameRange(monaco, model, source, span.start, span.length ?? 0);
    if (handlerRange) ranges.push(handlerRange);
  });
  return ranges;
}

/**
 * Resolve the exact range of the "handler" name within a function span.
 */
function resolveHandlerNameRange(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel,
  source: string,
  startOffset: number,
  spanLength: number
): IRange | undefined {
  const searchWindowEnd = spanLength ? startOffset + spanLength : source.length;
  const snippet = source.slice(startOffset, searchWindowEnd);
  const match = snippet.match(HANDLER_NAME_REGEX);
  if (!match?.[0] || match.index === undefined) return undefined;
  const absoluteStart = startOffset + match.index;
  const absoluteEnd = absoluteStart + match[0].length;
  const startPosition = model.getPositionAt(absoluteStart);
  const endPosition = model.getPositionAt(absoluteEnd);
  return new monaco.Range(startPosition.lineNumber, startPosition.column, endPosition.lineNumber, endPosition.column);
}
