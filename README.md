<h1 align="center">
  <img width="96" src="app/public/assets/logo.svg" alt="ToolBake"><br>
  ToolBake
</h1>

<p align="center"><b>A Platform for Creating Your Own Tools.</b></p>

<p align="center">
  <img width="800" src="app/public/assets/social-card.png" />
</p>

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

// todo:
Visit the documentation to learn about ToolBake's execution mechanism and how to create custom tools.

### Use AI Assistant to Create Tools

Creating custom tools requires writing `handler` code, defining UI components, and constant debugging — too much hassle?

// todo:
No problem. Visit the documentation to learn how to use the AI Assistant to quickly create tools that meet your needs.

## Log In to Sync Tools

By default, ToolBake only saves the tools you create and all related information locally in the browser.

While your information never leaves your device, this is quite inconvenient, so ToolBake also supports syncing your tool information after logging in.

Click the user avatar in the top-right corner to log in via SSO and enter login mode. When logged in, the following information will be saved to the server:

- Your custom tool `handler` code, UI definitions, and tool metadata

The following information will NOT be saved to the server:

- Your OpenAI endpoint and OpenAI API Key


### Secure Account Login System

The official ToolBake website has password login disabled by default. You can only log in via SSO, with optional 2FA authentication support.

For even more secure and convenient login, ToolBake also supports Passkey login.

You can configure your login strategy in the account settings after logging in.

> Want username/password login? Refer to the Self-Hosted section below and enable username/password login.

<img width="300" src="image/account.png" alt="account" />



## Roadmap

### Short Term

- [ ] Developer-facing documentation is incomplete; improve the development documentation
- [ ] Add project architecture documentation
- [ ] Support "DISABLE_USER_REGISTRATION" Env variable to disable new user registrations in self-hosted mode
- [ ] More SSO providers support


### Long Term

- [ ] i18n support
- [ ] Add [webvm](https://github.com/leaningtech/webvm) support, enabling `handler` to execute Linux virtual machine commands in the browser, expanding the capabilities of `handler` (e.g., calling the `openssl` command to generate keys, etc.)


## Self-Hosted

Thanks to the characteristics of Golang, self-hosting ToolBake is extremely simple.

You just need to download the binary and run it directly — that's all it takes to self-host. No runtime environment configuration, no complex setup required.

### Install

Visit the [Release page](https://github.com/WonderfulSoap/ToolBake/releases), download the corresponding ToolBake version, then:

```bash
chmod +x xxxxxx
./xxxxxx

```

All done.

<!-- ### Docker

If you prefer running software via Docker, you can also use the Docker configuration.

// todo: complete docker


### k8s

// todo: complete k8s deployment yaml

### Advanced Configuration

// todo:
All ToolBake configurations can be set through environment variables. Refer to the documentation to learn how to configure SSO and other settings.


## More Information

Please refer to the official documentation to learn about ToolBake's execution mechanism and how to create your own tools. -->
