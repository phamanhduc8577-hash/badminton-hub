import React from 'react'

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | undefined
  onChange: (value: number) => void
  suffix?: string
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  suffix = 'đ',
  className = '',
  placeholder = '0',
  ...rest
}) => {
  // Format number to dot-separated string (e.g. 500000 -> "500.000")
  const formatDisplay = (val: number | undefined) => {
    if (val === undefined || val === null || isNaN(val)) return ''
    return val.toLocaleString('vi-VN')
  }

  const [displayVal, setDisplayVal] = React.useState<string>(formatDisplay(value))

  React.useEffect(() => {
    setDisplayVal(formatDisplay(value))
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip everything except digits
    const rawDigits = e.target.value.replace(/\D/g, '')
    if (!rawDigits) {
      setDisplayVal('')
      onChange(0)
      return
    }

    const num = parseInt(rawDigits, 10)
    setDisplayVal(num.toLocaleString('vi-VN'))
    onChange(num)
  }

  return (
    <div className="relative flex items-center">
      <input
        type="text"
        inputMode="numeric"
        value={displayVal}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold focus:border-slate-900 focus:outline-none shadow-sm pr-8 ${className}`}
        {...rest}
      />
      {suffix && (
        <span className="absolute right-3 text-slate-400 font-bold text-xs pointer-events-none select-none">
          {suffix}
        </span>
      )}
    </div>
  )
}
