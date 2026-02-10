import {themes as prismThemes} from "prism-react-renderer";
import type {Config} from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title  : "ToolBake",
  tagline: "Build your own tools by ToolBake, powered by AI",
  favicon: "img/favicon.ico",

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url    : "https://docs.toolbake.com",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "WonderfulSoap", // Usually your GitHub org/user name.
  projectName     : "ToolBake", // Usually your repo name.

  onBrokenLinks: "throw",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales      : ["en"],
  },
  plugins: [
    "plugin-image-zoom",
  ],

  presets: [
    [
      "classic",
      {
        docs: {
          routeBasePath: "/docs",
          sidebarPath: "./sidebars.ts",
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            "https://github.com/WonderfulSoap/ToolBake/tree/main/docs-site/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image    : "img/social-card.svg",
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "ToolBake Docs - Build your own tools",
      logo : {
        alt: "ToolBake Logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type     : "docSidebar",
          sidebarId: "tutorialSidebar",
          position : "left",
          label    : "Tutorial",
        },
        {
          href    : "https://github.com/WonderfulSoap/ToolBake",
          label   : "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "Tutorial",
              to   : "/docs",
            },
          ],
        },
        // {
        //   title: "Community",
        //   items: [],
        // },
        {
          title: "More",
          items: [
            {
              label: "GitHub",
              href : "https://github.com/WonderfulSoap/ToolBake",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} ToolBake. Built with Docusaurus.`,
    },
    prism: {
      theme    : prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
    imageZoom: {
      // CSS selector to apply the plugin to, defaults to '.markdown img'
      selector: ".markdown img",
      // Optional medium-zoom options
      // see: https://www.npmjs.com/package/medium-zoom#options
      options : {
        
      },
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
