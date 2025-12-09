import type { UserConfig } from "vite"

export default {
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    "three": ["three"]
                }
            }
        }
    }
} satisfies UserConfig