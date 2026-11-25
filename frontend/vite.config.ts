import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const rootDir =
  typeof import.meta.dirname !== 'undefined'
    ? import.meta.dirname
    : path.dirname(fileURLToPath(import.meta.url))

function copyUserPhotoPlugin(): Plugin {
  const src = 'C:/Users/84919/Downloads/ed5faa63199e99c0c08f.jpg'
  const dest = path.resolve(rootDir, './public/anhduck-hero.jpg')

  const copyIfPossible = () => {
    try {
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest)
      }
    } catch {
      // ignore
    }
  }

  return {
    name: 'copy-user-photo',
    buildStart() {
      copyIfPossible()
    },
    configureServer(server) {
      copyIfPossible()
      server.middlewares.use((req, res, next) => {
        if (req.url === '/anhduck-hero.jpg' || req.url?.startsWith('/anhduck-hero.jpg?')) {
          if (fs.existsSync(dest)) {
            res.setHeader('Content-Type', 'image/jpeg')
            return fs.createReadStream(dest).pipe(res)
          } else if (fs.existsSync(src)) {
            res.setHeader('Content-Type', 'image/jpeg')
            return fs.createReadStream(src).pipe(res)
          }
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), copyUserPhotoPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  server: {
    port: 3000,
    strictPort: false,
    host: true,
  },
})

