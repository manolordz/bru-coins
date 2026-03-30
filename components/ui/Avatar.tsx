import Image from 'next/image'

interface AvatarProps {
  name: string
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizes = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 88,
}

const initials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

// Deterministic warm color from name
const avatarColor = (name: string) => {
  const colors = [
    'bg-amber-200 text-amber-800',
    'bg-orange-200 text-orange-800',
    'bg-yellow-200 text-yellow-800',
    'bg-lime-200 text-lime-800',
    'bg-rose-200 text-rose-800',
  ]
  const idx = name.charCodeAt(0) % colors.length
  return colors[idx]
}

export function Avatar({ name, avatarUrl, size = 'md', className = '' }: AvatarProps) {
  const px = sizes[size]
  const textSize = size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-2xl'
  const colorClass = avatarColor(name)

  if (avatarUrl) {
    return (
      <div
        className={`relative rounded-full overflow-hidden flex-shrink-0 ${className}`}
        style={{ width: px, height: px }}
      >
        <Image
          src={avatarUrl}
          alt={name}
          fill
          className="object-cover"
          sizes={`${px}px`}
        />
      </div>
    )
  }

  return (
    <div
      className={`rounded-full flex-shrink-0 flex items-center justify-center font-display font-semibold ${textSize} ${colorClass} ${className}`}
      style={{ width: px, height: px }}
    >
      {initials(name)}
    </div>
  )
}
