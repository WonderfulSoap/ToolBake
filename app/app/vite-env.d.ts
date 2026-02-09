/// <reference types="vite/client" />

// Declare markdown files imported with ?raw suffix as string modules
declare module "*.md?raw" {
  const content: string;
  export default content;
}
