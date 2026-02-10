/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Declare markdown files imported with ?raw suffix as string modules
declare module "*.md?raw" {
  const content: string;
  export default content;
}
