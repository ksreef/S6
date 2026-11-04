// Ambient declarations for Vite's asset imports, so plain TypeScript
// language servers see the same string-URL types Deno's checker resolves.
declare module "*.svg?no-inline" {
  const url: string;
  export default url;
}

declare module "*.svg" {
  const url: string;
  export default url;
}

declare module "*.png" {
  const url: string;
  export default url;
}

declare module "*.css";
