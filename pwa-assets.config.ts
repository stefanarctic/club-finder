import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// The source icon is full-bleed with its own safe zone, so no padding or white matte.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#050407' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#050407' } },
  },
  images: ['public/icon.svg'],
})
