import React, { useState } from 'react'

interface DuckMascotProps {
  className?: string
  size?: number
  rounded?: 'full' | '2xl' | '3xl' | 'xl'
  alt?: string
  src?: string
}

export const DuckMascot: React.FC<DuckMascotProps> = ({
  className = '',
  size = 48,
  rounded = '2xl',
  alt = 'SmashFlow Duck Champion Mascot',
  src = '/duck-mascot.png',
}) => {
  const [imgError, setImgError] = useState(false)

  // Reset imgError when src prop changes
  React.useEffect(() => {
    setImgError(false)
  }, [src])

  const roundedClass = {
    full: 'rounded-full',
    '3xl': 'rounded-3xl',
    '2xl': 'rounded-2xl',
    xl: 'rounded-xl',
  }[rounded]

  // Fallback to official mascot or SVG placeholder if image url fails
  const imgSrc = imgError || !src ? '/duck-mascot.png' : src

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none overflow-hidden ${roundedClass} border border-slate-200/80 bg-slate-900 shadow-md group ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={imgSrc}
        alt={alt}
        onError={() => setImgError(true)}
        className="w-full h-full object-cover object-top transition duration-300 group-hover:scale-105"
        loading="lazy"
      />
    </div>
  )
}
