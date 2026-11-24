import React, { useState } from 'react'
import { DuckMascot } from './DuckMascot'
import { AsciiArtCanvas, AsciiArtOptions } from './ui/ascii-art-canvas'

// Exact parameters from 21st.dev recipe requested by user
const MOSSAIC_RECIPE_OPTIONS: AsciiArtOptions = {
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
}

export const BadmintonHeroEditorial: React.FC = () => {
  const [showOriginal, setShowOriginal] = useState(false)
  const imageSource = '/anhduck-hero.jpg'
  const fallbackSource = '/badminton-bg-new.jpg'

  return (
    <div
      onClick={() => setShowOriginal((v) => !v)}
      className="relative w-full rounded-3xl overflow-hidden bg-slate-950 border border-white/10 shadow-2xl min-h-[460px] sm:min-h-[540px] flex flex-col justify-between p-6 sm:p-8 select-none cursor-pointer transition-transform active:scale-[0.99] group"
      title="Bấm vào ảnh để chuyển đổi giữa Ảnh gốc và ASCII Mossaic"
    >
      {/* Background Visual Layer */}
      <div className="absolute inset-0 pointer-events-none">
        {showOriginal ? (
          <img
            src={imageSource}
            onError={(e) => {
              ;(e.target as HTMLImageElement).src = fallbackSource
            }}
            alt="CLB Làng Địa Ngục"
            className="w-full h-full object-cover object-center filter brightness-[0.88] contrast-[1.08] transition-opacity duration-300"
          />
        ) : (
          <AsciiArtCanvas
            imageSrc={imageSource}
            fallbackSrc={fallbackSource}
            options={MOSSAIC_RECIPE_OPTIONS}
            className="w-full h-full"
          />
        )}

        {/* Minimal luxury vignette overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40 pointer-events-none" />
      </div>

      {/* Top Bar: Minimal Luxury Header */}
      <div className="relative z-10 flex items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-3">
          <DuckMascot size={36} rounded="xl" className="border border-white/20 shadow-lg" />
          <div>
            <span className="text-xs sm:text-sm font-black text-white tracking-widest uppercase block">
              CLB Làng Địa Ngục
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BadmintonHeroEditorial
