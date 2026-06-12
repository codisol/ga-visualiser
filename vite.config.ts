import type { UserConfig } from "vite"

export default {
    base: "/ga-visualiser/",
    build: {
        outDir: "dist",
        rollupOptions: {
            output: {
                manualChunks: {
                    "three": ["three"]
                }
            }
        }
    }
} satisfies UserConfig