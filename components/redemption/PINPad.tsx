'use client'

interface PINPadProps {
  value: string
  onChange: (pin: string) => void
  maxLength?: number
  disabled?: boolean
}

export function PINPad({ value, onChange, maxLength = 4, disabled = false }: PINPadProps) {
  const handleDigit = (d: string) => {
    if (disabled || value.length >= maxLength) return
    onChange(value + d)
  }

  const handleBackspace = () => {
    if (disabled) return
    onChange(value.slice(0, -1))
  }

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', '⌫'],
  ]

  return (
    <div className="w-full max-w-xs mx-auto">
      {/* PIN display dots */}
      <div className="flex items-center justify-center gap-4 mb-8">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ${
              i < value.length
                ? 'bg-bru-orange border-bru-orange scale-110'
                : 'border-bru-orange/30 bg-transparent'
            }`}
          />
        ))}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3">
        {keys.flat().map((key, idx) => {
          if (key === '') {
            return <div key={`empty-${idx}`} />
          }

          const isBackspace = key === '⌫'
          const isZero = key === '0'

          return (
            <button
              key={key}
              type="button"
              onClick={() => (isBackspace ? handleBackspace() : handleDigit(key))}
              disabled={disabled || (!isBackspace && value.length >= maxLength)}
              className={`
                h-16 rounded-2xl text-2xl font-medium transition-all duration-150
                active:scale-95 select-none
                ${isBackspace
                  ? 'text-bru-warm-gray bg-bru-light-gray hover:bg-bru-parchment hover:text-bru-black'
                  : 'bg-white text-bru-black shadow-card hover:bg-bru-orange hover:text-white hover:shadow-warm border border-bru-light-gray'
                }
                disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
              `}
            >
              {key}
            </button>
          )
        })}
      </div>
    </div>
  )
}
