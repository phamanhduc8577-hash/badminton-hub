import React, { useRef, useState, useCallback, useEffect } from 'react'

export interface Card3DTiltProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  maxTilt?: number
  perspective?: number
  glare?: boolean
  scale?: number
  ambientFloat?: boolean
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
}

export const Card3DTilt: React.FC<Card3DTiltProps> = ({
  children,
  className = '',
  style = {},
  maxTilt = 10,
  perspective = 1000,
  glare = true,
  scale = 1.02,
  ambientFloat = false,
  onClick,
}) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const glareRef = useRef<HTMLDivElement>(null)
  const rafId = useRef<number | null>(null)
  const [isHovered, setIsHovered] = useState(false)

  // Direct DOM updates via requestAnimationFrame: 60fps smooth tilt without React re-render lag
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const card = cardRef.current
      if (!card) return

      if (rafId.current) cancelAnimationFrame(rafId.current)

      rafId.current = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect()
        const x = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)
        const y = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1)

        const rotateX = Number(((0.5 - y) * maxTilt * 2).toFixed(2))
        const rotateY = Number(((x - 0.5) * maxTilt * 2).toFixed(2))

        card.style.transform = `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, 1)`

        if (glareRef.current) {
          const gx = (x * 100).toFixed(1)
          const gy = (y * 100).toFixed(1)
          glareRef.current.style.opacity = '0.2'
          glareRef.current.style.background = `radial-gradient(circle 350px at ${gx}% ${gy}%, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.2) 40%, transparent 80%)`
        }
      })
    },
    [maxTilt, perspective, scale]
  )

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true)
    if (cardRef.current) {
      cardRef.current.style.transition = 'transform 0.12s cubic-bezier(0.25, 1, 0.5, 1)'
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
    if (cardRef.current) {
      cardRef.current.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)'
      cardRef.current.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`
    }
    if (glareRef.current) {
      glareRef.current.style.opacity = '0'
    }
  }, [perspective])

  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [])

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative select-none will-change-transform ${
        ambientFloat && !isHovered ? 'animate-[float3d_6s_ease-in-out_infinite]' : ''
      } ${className}`}
      style={{
        perspective: `${perspective}px`,
        transformStyle: 'preserve-3d',
        transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`,
        transition: 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
        ...style,
      }}
    >
      {children}

      {glare && (
        <div
          ref={glareRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-30 rounded-[inherit] overflow-hidden opacity-0 transition-opacity duration-300"
          style={{ mixBlendMode: 'overlay' }}
        />
      )}
    </div>
  )
}
