import React, { useEffect, useRef, useState } from 'react'

export interface AsciiArtOptions {
  renderMode?: string
  bgMode?: 'blur' | 'solid' | 'original' | 'none'
  bgBlur?: number
  bgOpacity?: number
  cellSize?: number
  coverage?: number
  invert?: boolean
  styleBlend?: GlobalCompositeOperation
  charSet?: 'blocks' | 'ascii' | 'braille' | 'matrix' | 'hexdump' | 'simple' | string
  customChars?: string
  brightness?: number
  contrast?: number
  edgeEmphasis?: number
  density?: number
  toneCurve?: Array<{ x: number; y: number }>
  tint?: string
  tintOpacity?: number
  overlayBlend?: GlobalCompositeOperation
  saturation?: number
  grayscale?: number
  blurType?: string
  blurAmount?: number
  pfx?: {
    vignette?: { enabled: boolean; intensity: number }
    scanLines?: { enabled: boolean; intensity: number }
    chromatic?: { enabled: boolean; intensity: number }
    bloom?: { enabled: boolean; intensity: number }
    filmGrain?: { enabled: boolean; intensity: number }
    glitch?: { enabled: boolean; intensity: number }
    pixelate?: { enabled: boolean; intensity: number }
    halftone?: { enabled: boolean; intensity: number }
    filmDust?: { enabled: boolean; intensity: number }
  }
  animated?: boolean
  animStyle?: string
  animSpeed?: { enabled: boolean; intensity: number }
  animIntensity?: { enabled: boolean; intensity: number }
  lights?: {
    enabled: boolean
    points: Array<{ x: number; y: number; radius: number; intensity: number }>
  }
  mask?: {
    enabled: boolean
    dataUrl?: string | null
    invert?: boolean
  }
}

export const DEFAULT_ASCII_OPTIONS: AsciiArtOptions = {
  renderMode: 'characters',
  bgMode: 'blur',
  bgBlur: 0,
  bgOpacity: 94,
  cellSize: 3,
  coverage: 100,
  invert: false,
  styleBlend: 'source-over',
  charSet: 'blocks',
  customChars: '',
  brightness: -71,
  contrast: 100,
  edgeEmphasis: 0,
  density: 0,
  toneCurve: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 0.5042015678694158, y: 0.5047183507549361 },
  ],
  tint: '#ff7e4f',
  tintOpacity: 63,
  overlayBlend: 'overlay',
  saturation: 100,
  grayscale: 0,
  blurType: 'off',
  blurAmount: 35,
  pfx: {
    vignette: { enabled: true, intensity: 70 },
    scanLines: { enabled: true, intensity: 28 },
    chromatic: { enabled: true, intensity: 40 },
    bloom: { enabled: true, intensity: 60 },
    filmGrain: { enabled: true, intensity: 14 },
    glitch: { enabled: true, intensity: 11 },
    pixelate: { enabled: true, intensity: 0 },
    halftone: { enabled: true, intensity: 22 },
    filmDust: { enabled: true, intensity: 61 },
  },
  animated: false,
  animStyle: 'pulse',
  animSpeed: { enabled: false, intensity: 33 },
  animIntensity: { enabled: true, intensity: 60 },
  lights: { enabled: false, points: [] },
  mask: { enabled: false, dataUrl: null, invert: false },
}

const CHAR_SETS: Record<string, string[]> = {
  blocks: [' ', '░', '▒', '▓', '█'],
  ascii: [' ', '.', ':', '-', '=', '+', '*', '#', '%', '@'],
  simple: [' ', '.', '*', '#', '@'],
  matrix: [' ', '1', '0', 'X', 'Y', 'Z', '7', '9'],
  braille: [' ', '⠁', '⠃', '⠇', '⠏', '⠟', '⠿'],
  hexdump: [' ', '0', '2', '4', '8', 'A', 'C', 'E', 'F'],
}

interface AsciiArtCanvasProps {
  imageSrc: string
  fallbackSrc?: string
  options?: Partial<AsciiArtOptions>
  className?: string
  style?: React.CSSProperties
  onLoad?: () => void
}

export const AsciiArtCanvas: React.FC<AsciiArtCanvasProps> = ({
  imageSrc,
  fallbackSrc,
  options = {},
  className = '',
  style = {},
  onLoad,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const opts: AsciiArtOptions = {
    ...DEFAULT_ASCII_OPTIONS,
    ...options,
    pfx: {
      ...DEFAULT_ASCII_OPTIONS.pfx,
      ...(options.pfx || {}),
    },
  }

  // Load image
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      setImageLoaded(true)
      onLoad?.()
    }
    img.onerror = () => {
      if (fallbackSrc && img.src !== fallbackSrc) {
        img.src = fallbackSrc
      }
    }
    img.src = imageSrc
  }, [imageSrc, fallbackSrc, onLoad])

  // Main Canvas2D Render Pipeline
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    const img = imgRef.current
    if (!canvas || !container || !img || !imageLoaded) return

    const rect = container.getBoundingClientRect()
    const width = Math.max(Math.floor(rect.width), 100)
    const height = Math.max(Math.floor(rect.height), 100)

    // Match internal pixel resolution
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    ctx.scale(dpr, dpr)

    // 1. Offscreen canvas for sampling
    const offscreen = document.createElement('canvas')
    offscreen.width = width
    offscreen.height = height
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true })
    if (!offCtx) return

    // Draw cover image (aspect-fill)
    const imgAspect = img.naturalWidth / img.naturalHeight
    const targetAspect = width / height
    let sw: number, sh: number, sx: number, sy: number

    if (imgAspect > targetAspect) {
      sh = img.naturalHeight
      sw = sh * targetAspect
      sx = (img.naturalWidth - sw) / 2
      sy = 0
    } else {
      sw = img.naturalWidth
      sh = sw / targetAspect
      sx = 0
      sy = (img.naturalHeight - sh) / 2
    }

    offCtx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height)

    // Step 1: Draw Background per bgMode
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#030712'
    ctx.fillRect(0, 0, width, height)

    if (opts.bgMode === 'blur') {
      ctx.save()
      ctx.globalAlpha = (opts.bgOpacity ?? 94) / 100
      ctx.filter = `blur(${opts.bgBlur || 8}px)`
      ctx.drawImage(offscreen, 0, 0, width, height)
      ctx.restore()
    } else if (opts.bgMode === 'original') {
      ctx.save()
      ctx.globalAlpha = (opts.bgOpacity ?? 94) / 100
      ctx.drawImage(offscreen, 0, 0, width, height)
      ctx.restore()
    } else if (opts.bgMode === 'solid') {
      ctx.fillStyle = opts.tint || '#030712'
      ctx.fillRect(0, 0, width, height)
    }

    // Step 2 & 3: Sample Grid Cells & Draw Shapes/Characters
    const cellSize = Math.max(opts.cellSize || 3, 2)
    const sampleData = offCtx.getImageData(0, 0, width, height)
    const pixels = sampleData.data

    const charList =
      opts.customChars && opts.customChars.length > 0
        ? opts.customChars.split('')
        : CHAR_SETS[opts.charSet || 'blocks'] || CHAR_SETS.blocks

    ctx.save()
    if (opts.styleBlend) {
      ctx.globalCompositeOperation = opts.styleBlend
    }

    const contrast = opts.contrast ?? 100
    const brightness = opts.brightness ?? -71
    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast) || 1)
    const invert = Boolean(opts.invert)

    // Setup font for characters
    const fontSize = Math.floor(cellSize * 1.1)
    ctx.font = `900 ${fontSize}px "JetBrains Mono", Menlo, Consolas, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Parse Tint Color
    let tintR = 255,
      tintG = 126,
      tintB = 79
    if (opts.tint && opts.tint.startsWith('#')) {
      const hex = opts.tint.replace('#', '')
      if (hex.length === 6) {
        tintR = parseInt(hex.substring(0, 2), 16)
        tintG = parseInt(hex.substring(2, 4), 16)
        tintB = parseInt(hex.substring(4, 6), 16)
      }
    }
    const tintOpacity = (opts.tintOpacity ?? 63) / 100

    const renderMode = opts.renderMode || 'characters'
    const halfCell = cellSize / 2

    for (let y = 0; y < height; y += cellSize) {
      for (let x = 0; x < width; x += cellSize) {
        // Sample average color in cell
        let rSum = 0,
          gSum = 0,
          bSum = 0,
          count = 0
        const yMax = Math.min(y + cellSize, height)
        const xMax = Math.min(x + cellSize, width)

        for (let py = y; py < yMax; py += 2) {
          for (let px = x; px < xMax; px += 2) {
            const idx = (py * width + px) * 4
            rSum += pixels[idx]
            gSum += pixels[idx + 1]
            bSum += pixels[idx + 2]
            count++
          }
        }

        if (count === 0) continue

        let r = rSum / count
        let g = gSum / count
        let b = bSum / count

        // Step 4: Color Adjustments (Brightness, Contrast, Saturation)
        r = contrastFactor * (r - 128) + 128 + brightness
        g = contrastFactor * (g - 128) + 128 + brightness
        b = contrastFactor * (b - 128) + 128 + brightness

        r = Math.min(Math.max(r, 0), 255)
        g = Math.min(Math.max(g, 0), 255)
        b = Math.min(Math.max(b, 0), 255)

        // Tint blend
        r = r * (1 - tintOpacity) + tintR * tintOpacity
        g = g * (1 - tintOpacity) + tintG * tintOpacity
        b = b * (1 - tintOpacity) + tintB * tintOpacity

        // Standard luminance
        let lum = 0.299 * r + 0.587 * g + 0.114 * b
        if (invert) lum = 255 - lum

        const normLum = Math.min(Math.max(lum / 255, 0), 1)

        // Render per mode
        const cx = x + halfCell
        const cy = y + halfCell

        if (renderMode === 'characters') {
          const charIdx = Math.min(
            Math.floor(normLum * charList.length),
            charList.length - 1
          )
          const char = charList[charIdx]
          if (char && char !== ' ') {
            ctx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
            ctx.fillText(char, cx, cy)
          }
        } else if (renderMode === 'dots') {
          const rad = halfCell * normLum
          if (rad > 0.4) {
            ctx.beginPath()
            ctx.arc(cx, cy, rad, 0, Math.PI * 2)
            ctx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
            ctx.fill()
          }
        } else if (renderMode === 'mosaic' || renderMode === 'pixel') {
          ctx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
          ctx.fillRect(x, y, cellSize, cellSize)
        } else if (renderMode === 'cross') {
          ctx.strokeStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(x, cy)
          ctx.lineTo(x + cellSize, cy)
          ctx.moveTo(cx, y)
          ctx.lineTo(cx, y + cellSize)
          ctx.stroke()
        } else if (renderMode === 'halfblocks') {
          ctx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
          if (normLum > 0.5) {
            ctx.fillRect(x, y, cellSize, halfCell)
          } else if (normLum > 0.2) {
            ctx.fillRect(x, cy, cellSize, halfCell)
          }
        } else {
          // fallback characters
          const charIdx = Math.min(
            Math.floor(normLum * charList.length),
            charList.length - 1
          )
          const char = charList[charIdx]
          if (char && char !== ' ') {
            ctx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
            ctx.fillText(char, cx, cy)
          }
        }
      }
    }
    ctx.restore()

    // Step 5: Post-effects (pfx)
    const pfx = opts.pfx || {}

    // A. Chromatic Aberration
    if (pfx.chromatic?.enabled && pfx.chromatic.intensity > 0) {
      const shift = Math.max(Math.round((pfx.chromatic.intensity / 100) * 4), 1)
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = (pfx.chromatic.intensity / 100) * 0.45

      // Red channel shifted left
      ctx.drawImage(canvas, -shift, 0, width, height)
      // Blue channel shifted right
      ctx.drawImage(canvas, shift, 0, width, height)
      ctx.restore()
    }

    // B. Bloom (Luminous glow)
    if (pfx.bloom?.enabled && pfx.bloom.intensity > 0) {
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = (pfx.bloom.intensity / 100) * 0.4
      ctx.filter = `blur(${Math.round((pfx.bloom.intensity / 100) * 12)}px)`
      ctx.drawImage(canvas, 0, 0, width, height)
      ctx.restore()
    }

    // C. Scanlines (CRT texture)
    if (pfx.scanLines?.enabled && pfx.scanLines.intensity > 0) {
      ctx.save()
      ctx.fillStyle = `rgba(0, 0, 0, ${(pfx.scanLines.intensity / 100) * 0.4})`
      for (let sl = 0; sl < height; sl += 3) {
        ctx.fillRect(0, sl, width, 1)
      }
      ctx.restore()
    }

    // D. Film Grain & Film Dust
    if ((pfx.filmGrain?.enabled && pfx.filmGrain.intensity > 0) || (pfx.filmDust?.enabled && pfx.filmDust.intensity > 0)) {
      ctx.save()
      const grainAlpha = Math.min(((pfx.filmGrain?.intensity || 14) / 100) * 0.12, 0.2)
      ctx.fillStyle = `rgba(255, 255, 255, ${grainAlpha})`
      const grainCount = Math.floor((width * height) / 32)
      for (let i = 0; i < grainCount; i++) {
        const gx = Math.random() * width
        const gy = Math.random() * height
        ctx.fillRect(gx, gy, 1, 1)
      }

      // Film Dust specs
      if (pfx.filmDust?.enabled && pfx.filmDust.intensity > 0) {
        ctx.fillStyle = 'rgba(255, 220, 180, 0.35)'
        const dustCount = Math.floor(pfx.filmDust.intensity / 4)
        for (let d = 0; d < dustCount; d++) {
          const dx = Math.random() * width
          const dy = Math.random() * height
          const dlen = 1 + Math.random() * 3
          ctx.fillRect(dx, dy, dlen, 1)
        }
      }
      ctx.restore()
    }

    // E. Vignette
    if (pfx.vignette?.enabled && pfx.vignette.intensity > 0) {
      ctx.save()
      const vignetteIntensity = (pfx.vignette.intensity / 100) * 0.85
      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.3,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.72
      )
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, `rgba(3, 7, 18, ${vignetteIntensity})`)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }
  }, [imageLoaded, opts.renderMode, opts.cellSize, opts.tint, opts.brightness, opts.contrast])

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[380px] overflow-hidden bg-slate-950 ${className}`}
      style={style}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block object-cover"
      />
    </div>
  )
}

export default AsciiArtCanvas
