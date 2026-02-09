import sampleData from "./sample-data.json";


export const uiWidgets = [
  [
    {
      id   : "info_label",
      type : "LabelInput",
      title: "",
      mode : "output",
      props: {
        content: "<div class=\"text-sm text-muted-foreground\">Powered by <a href=\"https://jsonata.org/\" target=\"_blank\" class=\"font-medium text-primary underline underline-offset-2\">JSONata</a>. See documentation for syntax details.</div>",
        tone   : "default"
      }
    }
  ],
  [
    {
      id   : "jsonata_expression",
      type : "TextInput",
      title: "JSONata Expression",
      mode : "input",
      props: {
        placeholder : "$sum(example.value)",
        defaultValue: "store.book[price < 10].title"
      }
    }
  ],
  [
    {
      id   : "input_json",
      type : "TextareaInput",
      title: "Input JSON",
      mode : "input",
      props: {
        placeholder : "Paste your JSON here...",
        defaultValue: JSON.stringify(sampleData, null, 2),
        rows        : 15,
        highlight   : "highlight:json"
      }
    }
  ],
  [
    {
      id   : "output_result",
      type : "TextareaInput",
      title: "Result",
      mode : "input",
      props: {
        placeholder: "Result will appear here...",
        rows       : 15,
        highlight  : "highlight:json"
      }
    }
  ]
];