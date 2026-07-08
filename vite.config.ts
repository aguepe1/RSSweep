import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [viteSingleFile()],
  // El worker se importa con `?worker&inline`, así que su código se empaqueta
  // en base64 dentro del HTML único (sin ficheros sueltos, apto para file://).
  // Formato IIFE = worker clásico, soportado desde blob: en Chrome/Edge/Firefox.
  worker: { format: "iife" },
  build: {
    target: "es2022",
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    reportCompressedSize: true,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
