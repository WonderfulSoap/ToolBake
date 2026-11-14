import { describe, expect, it, vi } from "vitest";
import { ToolSandbox } from "~/components/tool/tool-sandbox";
import { EMBEDDED_PACKAGES } from "~/config/embedded-packages";
import { OfficialToolCsvToJsonConverter } from "./csv-to-json-converter/def";
import { OfficialToolJsonXmlYamlTomlConverter } from "./json-xml-yaml-toml-converter/def";
import { OfficialToolJsonataTester } from "./jsonata-tester/def";
import { OfficialToolXmlPrettifyMinify } from "./xml-prettify-minify/def";
import { OfficialToolMarkdownRenderer } from "./markdown-renderer/def";
import { OfficialToolIpv4SubnetCidrCalculator } from "./ipv4-cidr-subnet-toolkit/def";
import { OfficialToolIpv6SubnetToolkit } from "./ipv6-subnet-toolkit/def";

describe("Security upgrade compatibility", () => {
  it("retains Markdown tables, Unicode, linkification, and disabled HTML escaping", async () => {
    const sandbox = new ToolSandbox(OfficialToolMarkdownRenderer);
    const result = await sandbox.executeHandler({ "input-markdown": '| Name | Value |\n| --- | --- |\n| 中文 | **bold** |\n\nhttps://example.com\n\n<script>alert(1)</script>', linkify: true, "allow-html": false }, "input-markdown", vi.fn());
    const html = String(result?.["output-html"]);
    expect(html).toContain("<table>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("calculates IPv4 subnet boundaries including point-to-point networks", async () => {
    const sandbox = new ToolSandbox(OfficialToolIpv4SubnetCidrCalculator);
    const result = await sandbox.executeHandler({ cidr_input: "192.168.1.99/24" }, "cidr_input", vi.fn());
    expect(result?.result_values).toMatchObject({ network_address: "192.168.1.0", broadcast_address: "192.168.1.255", first_address: "192.168.1.1", last_address: "192.168.1.254", network_size: "256" });
    const pair = await sandbox.executeHandler({ cidr_input: "192.168.1.0/31" }, "cidr_input", vi.fn());
    expect(pair?.result_values).toMatchObject({ first_address: "192.168.1.0", last_address: "192.168.1.1", network_size: "2" });
  });

  it("keeps IPv6 arithmetic exact for networks larger than Number.MAX_SAFE_INTEGER", async () => {
    const sandbox = new ToolSandbox(OfficialToolIpv6SubnetToolkit);
    const result = await sandbox.executeHandler({ cidr_input: "2001:db8::1234/64" }, "cidr_input", vi.fn());
    expect(result?.result_values).toMatchObject({ network_address: "2001:db8::", network_size: "18446744073709551616", first_address: "2001:db8::1", last_address: "2001:db8::ffff:ffff:ffff:fffe" });
  });

  it("parses TOML arrays of tables, quoted keys, and timestamps through the converter", async () => {
    const sandbox = new ToolSandbox(OfficialToolJsonXmlYamlTomlConverter);
    const toml = 'created = 1979-05-27T07:32:00Z\n"a.b" = "中文"\n[[items]]\nname = "first"\n[[items]]\nname = "second"';
    const result = await sandbox.executeHandler({ "toml-input": toml }, "toml-input", vi.fn());
    expect(JSON.parse(String(result?.["json-input"]))).toEqual({ created: "1979-05-27T07:32:00.000Z", "a.b": "中文", items: [{ name: "first" }, { name: "second" }] });
  });

  it("runs the CSV tool with quoted delimiters, multiline fields, Unicode, and JSONPath", async () => {
    const sandbox = new ToolSandbox(OfficialToolCsvToJsonConverter);
    const result = await sandbox.executeHandler({ csv_input: 'name,note\n中文,"hello, world\nsecond line"', json_path: "$[0]" }, "csv_input", vi.fn());
    expect(JSON.parse(result?.json_output as string)).toEqual({ name: "中文", note: "hello, world\nsecond line" });
  });

  it("round-trips the converter's JSON data through XML, YAML, and TOML", async () => {
    const sandbox = new ToolSandbox(OfficialToolJsonXmlYamlTomlConverter);
    const data = { title: "日本語 & <text>", enabled: true, count: 3, settings: { name: "ToolBake" } };
    const outputs = await sandbox.executeHandler({ "json-input": JSON.stringify(data) }, "json-input", vi.fn());
    for (const key of ["xml-input", "yaml-input", "toml-input"]) {
      const result = await sandbox.executeHandler({ [key]: outputs?.[key] }, key, vi.fn());
      const expected = key === "xml-input" ? { root: data } : data;
      expect(JSON.parse(result?.["json-input"] as string)).toEqual(expected);
    }
  });

  it("preserves XML attributes and escaped text in both formatter modes", async () => {
    const sandbox = new ToolSandbox(OfficialToolXmlPrettifyMinify);
    const { XMLParser } = await EMBEDDED_PACKAGES["fast-xml-parser"].load();
    const parser = new XMLParser({ ignoreAttributes: false });
    const xml = '<root title="a &amp; b"><name>日本語 &lt;safe&gt;</name></root>';
    for (const mode of ["prettify", "minify"]) {
      const result = await sandbox.executeHandler({ "xml-input": xml, mode }, "xml-input", vi.fn());
      expect(parser.parse(result?.["xml-output"])).toEqual(parser.parse(xml));
    }
  });

  it("evaluates JSONata through the real embedded package loader", async () => {
    const sandbox = new ToolSandbox(OfficialToolJsonataTester);
    const result = await sandbox.executeHandler({ input_json: '{"items":[{"price":2},{"price":3}]}', jsonata_expression: "$sum(items.price)" }, "input_json", vi.fn());
    expect(result?.output_result).toBe("5");
  });

  it("keeps Handlebars escaping working after its security update", async () => {
    const handlebars = await EMBEDDED_PACKAGES.handlebars.load();
    const templates = handlebars.default ?? handlebars;
    expect(templates.compile("Hello {{name}}")({ name: "<script>" })).toBe("Hello &lt;script&gt;");
  });

  it("signs and verifies with Forge using the browser Buffer implementation", async () => {
    // JSDOM and Node use different typed-array realms; match the browser's Buffer shim.
    const { Buffer } = await import("buffer/index.js");
    vi.stubGlobal("Buffer", Buffer);
    try {
      const forgeModule = await EMBEDDED_PACKAGES["node-forge"].load();
      const forge = forgeModule.default ?? forgeModule;
      const keys = forge.pki.ed25519.generateKeyPair({ seed: Buffer.alloc(32, 7) });
      const message = Buffer.from("ToolBake");
      const signature = forge.pki.ed25519.sign({ message, privateKey: keys.privateKey });
      expect(forge.pki.ed25519.verify({ message, signature, publicKey: keys.publicKey })).toBe(true);
      expect(forge.pki.ed25519.verify({ message: Buffer.from([0]), signature, publicKey: keys.publicKey })).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
