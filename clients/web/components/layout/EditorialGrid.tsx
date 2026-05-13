import { ReactNode } from 'react'

interface EditorialGridProps {
  children: ReactNode
  className?: string
  as?: React.ElementType
}

/**
 * The core 12-column foundation for all cinematic layouts.
 * Replaces symmetrical Flexbox splits.
 */
export function EditorialGrid({ 
  children, 
  className = '', 
  as: Component = 'div' 
}: EditorialGridProps) {
  return (
    <Component className={`grid grid-cols-12 gap-x-4 md:gap-x-6 w-full ${className}`}>
      {children}
    </Component>
  )
}

interface GridColProps {
  children: ReactNode
  span: number      // How many columns this element occupies (1-12)
  start?: number    // Which column line it starts on (1-13)
  className?: string
  as?: React.ElementType
}

/**
 * An individual actor within the EditorialGrid.
 * Allows for deliberate asymmetry and overlaps.
 */
export function GridCol({
  children,
  span,
  start,
  className = '',
  as: Component = 'div'
}: GridColProps) {
  return (
    <Component
      className={className}
      style={{
        // Bypassing Tailwind's purge limitations for dynamic grid placement
        gridColumn: `${start ? `${start} / ` : ''}span ${span}`
      }}
    >
      {children}
    </Component>
  )
}