---
sidebar_position: 1
slug: /
---

# ToolBake

**A Platform for Creating Your Own Tools.**

![ToolBake](/img/social-card.svg)

---

## What is ToolBake

ToolBake is a platform for creating your own tools. It provides a rich set of UI components and a powerful editor to help you create your own tools.

ToolBake offers incredibly powerful capabilities, ranging from common development tools to video processing, audio processing, image processing, AI Agent frontends, and even serving as a simple UI frontend.

## How is ToolBake Different from Other Toolboxes?

### 🎨 High Customizability & Cross-Platform Support

Existing toolboxes can't meet your personalized needs — special text processing rules, customized audio trimming workflows, specific image batch processing...

Previously, you could only write scripts or use command-line tools, which were limited to your local computer and unusable on other devices.

ToolBake lets you freely customize tools in the browser — **create once, use on any platform**.

### 🤖 Don't Want to Write Code? Let AI Customize Tools for You

Developing custom tools for ToolBake requires understanding ToolBake's tool execution mechanism, then writing `uiWidgets` JSON definitions and `handler.js` function code.

If you find it too troublesome or don't want to spend too much time — no worries. Thanks to ToolBake's excellent AI support, you can directly use the built-in AI Assistant to create tools. (The AI Assistant runs entirely in the browser; the server has no involvement whatsoever.)

You just need to chat with the AI, describe your requirements, and the AI will automatically create the tool for you.

### 🚀 Rich Feature Support

Although ToolBake runs in the browser, the features it supports go far beyond what you might expect — in addition to the browser's native capabilities, it even supports running `ffmpeg`, `ffprobe`, `ImageMagick`, and more directly in the browser.

If these embeded tools don't meet your needs, you can also import any npm package to fulfill your requirements.

### 🔒 Privacy First: Fully Local Execution

ToolBake tools run entirely in the browser; the server has no involvement whatsoever.

This means you can safely use ToolBake to process any sensitive data — **your data never leaves your device**.

### Extremely Simple Self-Hosted Experience

Tired of configuring runtime environments and writing config files? Just download the ToolBake binary and run it directly. No configuration needed at all.

## Getting Started

### Try the Official Tools

ToolBake comes with a rich set of built-in Official Tools:

- 🧮 Life utility tools
- 🛠️ General development tools
- 🎵 Audio processing tools
- 🎬 Video processing tools
- 🖼️ Image processing tools
- 👾 Games
- 🤖 AI Agent frontends
- ✨ And more

All of these tools are implemented through ToolBake's tool customization mechanism. Any feature supported by the official tools can be fully replicated in your own tools.

Visit the [ToolBake Demo website](https://toolbake.com) now to try out the various official tools and experience ToolBake's powerful capabilities.

### Create Custom Tools

Custom tools are the core feature of ToolBake and the biggest differentiator from other toolboxes.

Visit the [documentation](./tutorial/baseic-concepts.md) to learn about ToolBake's execution mechanism and how to create custom tools.

### Use AI Assistant to Create Tools

Creating custom tools requires writing `handler` code, defining UI components, and constant debugging — too much hassle?

No problem. Visit the [documentation](./tutorial/use-ai-to-create-tool.md) to learn how to use the AI Assistant to quickly create tools that meet your needs.
