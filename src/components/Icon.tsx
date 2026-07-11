import type { CSSProperties } from 'react'

interface IconProps {
  name: string
  size?: number
  fill?: number
  weight?: number
  grade?: number
  opsz?: number
  className?: string
  style?: CSSProperties
}

export default function Icon({ name, size = 15, fill = 0, weight = 400, grade = 0, opsz = 24, className, style }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${fill}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${opsz}`,
        ...style,
      }}
    >
      {name}
    </span>
  )
}
