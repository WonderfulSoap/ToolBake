# Guide to Adding a New Input Widget Component

This document contains two parts:
1. **Component Creation Guide**: How to create a new Input Widget component
2. **Test Writing Guide**: How to write test cases for the new component

---

## Part 1: Component Creation Guide

### Component Interface Specification

- **Clear data flow**: The component initializes its internal state with a type-appropriate empty default value. The parent component sets values (including defaultValue) via `collectValueRef.current.setValue()`, and the child component notifies the parent of user input changes through the `onChange` callback
- **defaultValue is not managed internally by the component**: The component does not read `props.defaultValue` directly to initialize state. Instead, the parent component calls `setValue()` to set the initial value after the component is loaded
- **Unified value collection interface**: Exposes `getValue()` and `setValue()` methods through `collectValueRef`
- **Easy to test**: Components can be tested directly without Context mocks

### Component File Structure

Create a new component file under the `app/components/input-widgets/` directory. The following must be exported:

#### Props Schema (defined using zod)

Different components have their own props. Define different props based on the component's functionality.

**defaultValue naming convention**: When a component's props require a default value field, **you must use `defaultValue` as the field name**. The parent component automatically sets the initial value based on the fixed name `defaultValue`. If a different name is used (e.g., `defaultCurrent`, `defaultText`, etc.), the parent component will not be able to recognize and automatically set the default value.

```typescript
export const YourInputProps = z.object({
  // All fields should be optional
  placeholder: z.string().optional(),
  size       : z.enum(["normal", "mini"]).optional(),
  width      : z.string().optional(),  // Controls the component width
});
export type YourInputProps = z.infer<typeof YourInputProps>;
```

#### Output Value Schema

Define the type for the component's output value based on the component's functionality.
The types of `props.defaultValue`, the return value of `collectValueRef.current.getValue()`, and the parameter of `collectValueRef.current.setValue()` are all of this type.

The `YourInputOutputValueResolver()` function is used to dynamically retrieve the component's output value type for type checking during tool execution.

```typescript
export const YourInputOutputValue = z.string();  // Or other types
export type YourInputOutputValue = z.infer<typeof YourInputOutputValue>;

export function YourInputOutputValueResolver(): z.ZodTypeAny {
  return YourInputOutputValue;
}
```

#### Usage Example (for Guide Panel)
You also need to define a Usage Example to display the component's example usage JSON in the UI Widgets Guide Panel in edit mode.

```typescript
export const YourInputUsageExample: WidgetGuideItem = {
  name       : "Your Input",
  description: "Description of the component's functionality",
  widget     : {
    id   : "guide-your-input",
    type : "YourInput",
    title: "Example Title",
    mode : "input",
    props: { /* Example props */ },
  },
};
```

#### Component Factory Function

```typescript
import { useState, useImperativeHandle, useRef, type RefObject, type ChangeEvent } from "react";
import type { WidgetValueCollectorInf } from "./input-types";
import type { ToolUIWidgetMode } from "~/entity/tool";

export function YourInput(
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  onChange: (id: string, newValue: YourOutputType) => void,                 // Callback invoked when the value changes
  collectValueRef: RefObject<WidgetValueCollectorInf<YourOutputType> | undefined | null>,  // Interface for the parent component to get/set the component value
  props?: YourInputProps
) {
  const { placeholder, size, width } = YourInputProps.parse(props ?? {});
  const isOutputMode = mode === "output";

  // Internal state management: initialize with type-appropriate empty default value; the parent component sets the initial value via setValue()
  // Use state to render UI, use ref to ensure getValue always retrieves the latest value
  const [widgetValue, setWidgetValue] = useState<YourOutputType>(YourInputDefaultValue);
  const valueRef = useRef<YourOutputType>(YourInputDefaultValue);

  // Expose getValue and setValue methods
  useImperativeHandle(collectValueRef, () => ({
    getValue: () => valueRef.current,
    // Allow the parent component to set the value without triggering onChange (used for setting initial values and handler writing back output widget values)
    setValue: (newValue: YourOutputType) => {
      valueRef.current = newValue;
      setWidgetValue(newValue);
    },
  }), []);

  // Listen for HTML input events; when the value changes, sync the ref and state, and notify the parent component
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value;
    valueRef.current = nextValue;
    setWidgetValue(nextValue);
    onChange(id, nextValue);
  }

  return (
    <div className={cn("group", width && "flex-shrink-0")} style={width ? { width } : undefined}>
      {/* Component UI */}
      // HTML responds to user input based on the type and calls handleChange(event)
    </div>
  );
}
```

### State Management Pattern

**Important**: The component does not use `props.defaultValue` to initialize state internally. Instead, it uses a type-appropriate empty default value (e.g., `""`, `0`, `false`, `[]`, `{}`, `null`, etc.). The parent component sets the initial value (including defaultValue) via `collectValueRef.current.setValue()` after the component is loaded, and retrieves the value via `collectValueRef.current.getValue()`.

#### Standard Pattern: Dual Synchronization with state + ref

**Recommended for most components**. Uses useState to drive UI rendering, and useRef to ensure getValue always retrieves the latest value.

1. **`widgetValue` (useState)**: Stores the component state for rendering and immediate feedback
2. **`valueRef` (useRef)**: Stores the component state for `getValue()` to retrieve the real-time latest value

```typescript
// Initialize with type-appropriate empty default value; the parent component sets the initial value via setValue()
const [widgetValue, setWidgetValue] = useState<string>("");
const valueRef = useRef<string>("");

// Expose getValue and setValue
useImperativeHandle(collectValueRef, () => ({
  getValue: () => valueRef.current,
  setValue: (newValue: string) => {
    valueRef.current = newValue;
    setWidgetValue(newValue);
  },
}), []);

// Respond to HTML events, synchronously update ref and state
function handleChange(event: ChangeEvent<HTMLInputElement>) {
  const nextValue = event.target.value;
  valueRef.current = nextValue;
  setWidgetValue(nextValue);
  onChange(id, nextValue);
}
```

#### Direct DOM Read Pattern

**Suitable for components where the value can be read directly from the DOM** (e.g., input, textarea). getValue reads from the DOM first.

```typescript
// Initialize with type-appropriate empty default value; the parent component sets the initial value via setValue()
const [widgetValue, setWidgetValue] = useState<string>("");
const inputRef = useRef<HTMLInputElement>(null);

// Expose getValue (reads from DOM) and setValue
useImperativeHandle(collectValueRef, () => ({
  getValue: () => inputRef.current?.value ?? widgetValue,
  setValue: (newValue: string) => {
    if (inputRef.current) inputRef.current.value = newValue;
    setWidgetValue(newValue);
  },
}), [widgetValue]);
```



### Default Empty Values by Type Reference

| Output Value Type | Default Empty Value | Example |
|-------------------|---------------------|---------|
| `string` | `""` | TextInput, TextareaInput |
| `number` | `0` | NumberInput, SliderInput, ButtonInput |
| `boolean` | `false` | ToggleInput |
| `string \| undefined` | `undefined` | SelectListInput, RadioGroupInput |
| `string[]` | `[]` | TagInput |
| `object[]` | `[]` | SortableListInput |
| `Record<string, T>` | `{}` | MultiTextInput, ProgressBarInput |
| `File \| null` | `null` | FileUploadInput |
| `File[] \| null` | `null` | FilesUploadInput |

### Special Component Type Handling

#### Output Mode

When the component's mode is "output", the component should be in a read-only state. Define the read-only state according to each component's characteristics, and do not respond to user input events.


#### Display-Only Components (e.g., DividerInput)

These do not accept user input, and the output value is always a fixed value:

```typescript
export function DividerInput(
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  onChange: (id: string, newValue: null) => void,
  collectValueRef: RefObject<WidgetValueCollectorInf<null> | undefined>,
  props?: DividerInputProps
) {
  // No useState needed
  useImperativeHandle(collectValueRef, () => ({
    getValue: () => null,
    setValue: () => {},  // setValue is a no-op for display-only components
  }), []);  // Empty dependency array

  // Pure rendering logic
}
```

#### Numeric Type Components (e.g., NumberInput)

Pay attention to type conversion; initialize with `0`:

```typescript
// Initialize with 0; the parent component sets the initial value via setValue()
const [widgetValue, setWidgetValue] = useState<number>(0);
const valueRef = useRef<number>(0);

useImperativeHandle(collectValueRef, () => ({
  getValue: () => valueRef.current,
  setValue: (newValue: number) => {
    valueRef.current = newValue;
    setWidgetValue(newValue);
  },
}), []);

function handleChange(event: ChangeEvent<HTMLInputElement>) {
  const rawValue = event.target.value;
  const nextValue = rawValue === "" ? NaN : Number(rawValue);
  valueRef.current = nextValue;
  setWidgetValue(nextValue);
  onChange(id, nextValue);
}
```

#### Button-Type Components (e.g., ButtonInput)

Clicks trigger value changes, using timestamps to ensure each click produces a new value. Initialize with `0`:

```typescript
// Initialize with 0; the value is not read, only used to trigger re-renders
const [, setWidgetValue] = useState<number>(0);
const valueRef = useRef<number>(0);

useImperativeHandle(collectValueRef, () => ({
  getValue: () => valueRef.current,
  setValue: (newValue: number) => {
    valueRef.current = newValue;
    setWidgetValue(newValue);
  },
}), []);

function handleClick() {
  const nextValue = Date.now();
  valueRef.current = nextValue;
  setWidgetValue(nextValue);
  onChange(id, nextValue);
}
```

### Registering the Component in the System

#### Update input-types.ts

```typescript
// 1. Import the component
import { YourInput, YourInputProps, YourInputOutputValueResolver } from "./your-input";

// 2. Add to the ToolInputType enum
export const ToolInputType = z.enum([
  // ... existing types
  "YourInput",
]);

// 3. Add to the component mapping table
export const ToolInputTypeUiComponentInfoConvertMap: Record<ToolInputType, ...> = {
  // ... existing mappings
  YourInput: { propsSchema: YourInputProps, uiComponentFactory: YourInput },
};

// 4. Add to the output value schema mapping
export const ToolInputTypeOutputSchemaMap: Record<ToolInputType, ...> = {
  // ... existing mappings
  YourInput: YourInputOutputValueResolver,
};
```

#### Update UI Widgets Guide Panel

Import and add the example in `app/components/creator/ui-widgets-guide-panel.tsx`:

```typescript
import { YourInputUsageExample } from "~/components/input-widgets/your-input";

const widgetGuideItems: WidgetGuideItem[] = [
  // ... existing examples
  YourInputUsageExample,
];
```

### Component Implementation Key Points

- **Consistent height**: All input component main containers have a height of `h-10` (40px) to ensure consistent height within the same row
  - Exceptions: Special components like RadioGroupInput, FileUploadInput, etc. may have their own height
- **width support**: The outer div uses `className={cn("group", width && "flex-shrink-0")}` and `style={width ? { width } : undefined}`
- **Output mode**: When `mode === "output"`, the component should be in a read-only state
- **DOM ID binding**: Form elements must bind `id={`tool-input-${id}`}` for the label's `htmlFor`

---

## Part 2: Test Writing Guide

When creating a new Input Widget component, in addition to the functional implementation, you also need to write comprehensive test cases for the component. This section summarizes the common test scenarios that all new components must consider.

## Test File Naming and Structure

- Test file naming: `{component-name}.test.tsx` (in the same directory as the component file)
- Use vitest as the testing framework
- Use `@testing-library/react` for component rendering and querying
- Use `@testing-library/user-event` for simulating user interactions

## Required Test Scenarios

### Props Schema Validation

**Purpose**: Verify that the component's props definition (zod schema) is correct

**Test points**:
- Verify all props fields parse correctly
- Verify optional fields can be omitted
- Verify all valid values for enum types
- Verify invalid values are rejected
- Verify true/false for boolean types

**Example**:
```typescript
describe("Props Schema Validation", () => {
  it("parses valid props correctly", () => {
    const validProps = { /* all fields */ };
    const result = YourInputProps.parse(validProps);
    expect(result).toEqual(validProps);
  });

  it("parses props with optional fields omitted", () => {
    const result = YourInputProps.parse({});
    expect(result).toEqual({});
  });
});
```

### Output Value Schema Validation

**Purpose**: Verify that the component's output value type definition is correct

**Test points**:
- Verify valid output value types pass validation
- Verify invalid types are rejected
- Test boundary values (empty values, maximum values, etc.)

**Example**:
```typescript
describe("Output Value Schema", () => {
  it("validates correct output values", () => {
    const resolver = YourInputOutputValueResolver();
    expect(resolver.parse(validValue)).toBe(validValue);
  });

  it("rejects invalid values", () => {
    const resolver = YourInputOutputValueResolver();
    expect(() => resolver.parse(invalidValue)).toThrow();
  });
});
```

### Value Collection Tests (collectValueRef)

**Purpose**: Verify that the component's value collection mechanism works correctly

#### 3.1 Creating the Component with Different Initial Values

**Test points**:
- Use a case array to define multiple initial value scenarios
- After creating the component, set the initial value via `collectValueRef.current.setValue()` (simulating parent component behavior)
- Verify that the value collected by collectValueRef matches the set value
- Cover edge cases: empty values, special characters, Unicode, very long strings, etc.

**Example**:
```typescript
describe("Value Collection with collectValueRef", () => {
  const testCases = [
    { name: "empty value", initialValue: "" },
    { name: "normal text", initialValue: "hello" },
    { name: "unicode", initialValue: "你好🌍" },
    { name: "special chars", initialValue: "<script>" },
    // ... more cases
  ];

  testCases.forEach(({ name, initialValue }) => {
    it(`collects correct value for ${name}`, () => {
      const collectValueRef = createRef();
      render(<Component collectValueRef={collectValueRef} />);
      // Simulate the parent component setting the initial value via setValue
      act(() => {
        collectValueRef.current?.setValue(initialValue);
      });
      expect(collectValueRef.current?.getValue()).toBe(initialValue);
    });
  });
});
```

#### 3.2 Verifying After Setting Values via setValue

**Test points**:
- After creating the component, set different values via `collectValueRef.current.setValue()`
- Verify that `getValue()` retrieves the latest value after each set operation
- Use `waitFor` to wait for state updates to complete

**Example**:
```typescript
it("getValue returns correct value after multiple setValue calls", async () => {
  const collectValueRef = createRef();
  const values = ["value1", "value2", "value3"];

  render(<Component collectValueRef={collectValueRef} />);
  // The component's initial value is the type-appropriate empty default
  expect(collectValueRef.current?.getValue()).toBe("");

  for (const value of values) {
    act(() => {
      collectValueRef.current?.setValue(value);
    });
    await waitFor(() => {
      expect(collectValueRef.current?.getValue()).toBe(value);
    });
  }
});
```

### User Interaction and Value Synchronization Tests

**Purpose**: Verify that onChange and collectValueRef values stay consistent during user interaction

**Test points**:
- Simulate user input (typing, clearing, pasting, etc.)
- Verify the onChange callback receives the correct value
- Verify the value collected by collectValueRef matches onChange
- Verify the DOM element's actual value is also consistent
- Test multiple input scenarios (appending, clearing and re-typing, special characters, etc.)

**Example**:
```typescript
it("onChange and collectValueRef return same value after user input", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const collectValueRef = createRef();

  const inputCases = [
    { action: "type", value: "hello", expected: "hello" },
    { action: "clear-and-type", value: "world", expected: "world" },
    // ... more cases
  ];

  render(<Component onChange={onChange} collectValueRef={collectValueRef} />);
  const input = screen.getByRole("textbox");

  for (const { action, value, expected } of inputCases) {
    onChange.mockClear();

    if (action === "clear-and-type") {
      await user.clear(input);
      await user.type(input, value);
    } else {
      await user.type(input, value);
    }

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(lastCall[1]).toBe(expected);
    expect(collectValueRef.current?.getValue()).toBe(expected);
    expect(input.value).toBe(expected);
  }
});
```

### Output Mode Tests

**Purpose**: Verify the component's behavior in read-only mode

**Test points**:
- Verify the component renders in a read-only state (readonly attribute)
- Verify that user input attempts do not trigger onChange
- Verify the value remains unchanged
- Verify collectValueRef can still collect values correctly
- Test with multiple different initial values

**Example**:
```typescript
it("in output mode, user input does not trigger onChange but collectValueRef works", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const collectValueRef = createRef();

  const testCases = [
    { initialValue: "readonly1", attemptInput: "try to change" },
    { initialValue: "readonly2", attemptInput: "another try" },
  ];

  for (const { initialValue, attemptInput } of testCases) {
    onChange.mockClear();

    const { unmount } = render(
      <Component mode="output" onChange={onChange} collectValueRef={collectValueRef} />
    );

    // Set the initial value via setValue (simulating parent component behavior)
    act(() => {
      collectValueRef.current?.setValue(initialValue);
    });

    const input = screen.getByRole("..."); // Adjust based on component type

    // Verify read-only state
    expect(input.readOnly || input.disabled).toBe(true);

    // Verify collectValueRef can collect the value
    expect(collectValueRef.current?.getValue()).toBe(initialValue);

    // Attempt to input
    await user.type(input, attemptInput);

    // Verify onChange was not called
    expect(onChange).not.toHaveBeenCalled();

    // Verify value has not changed
    expect(collectValueRef.current?.getValue()).toBe(initialValue);

    unmount();
  }
});
```

### Props Application Verification

**Purpose**: Verify that each props field is correctly applied to the component

**Test points**:
- Create an independent test case for each props field
- Use the case array + forEach + it pattern
- Each case includes: props configuration and verification logic
- Verify DOM element attributes, styles, class names, etc. are correct

**Example**:
```typescript
describe("Props Application Verification", () => {
  const propsCases = [
    {
      name: "placeholder",
      props: { placeholder: "Enter text" },
      verify: () => {
        expect(screen.getByPlaceholderText("Enter text")).toBeTruthy();
      },
    },
    {
      name: "size=mini",
      props: { size: "mini" },
      verify: () => {
        const element = screen.getByRole("...");
        expect(element.className).toContain("h-8");
      },
    },
    {
      name: "width",
      props: { width: "200px" },
      verify: () => {
        const container = screen.getByRole("...").closest(".group");
        expect(container.style.width).toBe("200px");
      },
    },
    // ... create a case for each prop field
  ];

  propsCases.forEach(({ name, props, verify }) => {
    it(`correctly applies ${name} prop`, () => {
      render(<Component {...defaultProps} props={props} />);
      verify();
    });
  });
});
```

## Other Common Test Scenarios

### DOM Rendering Tests
- Verify the component's basic structure renders correctly
- Verify label, title, and other elements are present
- Verify SafeHtml processing (if used)

### Boundary Value Tests
- Empty value handling
- Very long strings
- Unicode characters (Chinese, emoji)
- Special characters (HTML tags, escape characters)

### User Interaction Tests
- Various input methods (type, paste, clear)
- Focus management
- Keyboard events (if applicable)

### Style Variant Tests
- Different sizes (normal, mini, etc.)
- Width control
- Visual effects of read-only/disabled states

## Test Writing Best Practices

1. **Use case arrays**: For scenarios that need to test multiple values, use the case array + forEach + it pattern
2. **Independence**: Each test should be independent and not rely on the execution results of other tests
3. **Cleanup**: For tests that create multiple component instances, remember to unmount
4. **Async waiting**: Use `waitFor` for tests involving state updates
5. **Descriptive naming**: Test names should clearly describe the test content
6. **Grouping**: Use `describe` to group related tests

## Test Coverage Requirements

Newly added Input Widget components should achieve:
- Statement coverage > 90%
- Branch coverage > 85%
- Function coverage = 100%

Run tests and view coverage:
```bash
npm test -- your-component.test.tsx --coverage
```

## Reference Examples

Complete test examples can be found at:
- `app/components/input-widgets/text-input.test.tsx` - Complete text input component tests
- `app/components/input-widgets/button-input.test.tsx` - Button component tests (if available)

## Test Checklist

Before submitting a new component, ensure:

- [ ] Props Schema validation tests completed
- [ ] Output Value Schema validation tests completed
- [ ] Value Collection (different initial values) tests completed
- [ ] Value Collection (multiple rerenders) tests completed
- [ ] User interaction and value synchronization tests completed
- [ ] Output mode tests completed
- [ ] Each props field has independent tests
- [ ] Boundary value and special character tests completed
- [ ] All tests pass
- [ ] No linter errors
- [ ] Test coverage meets requirements
