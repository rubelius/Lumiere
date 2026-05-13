import { cn } from '@/lib/utils'
import { Container } from './Container'

interface SectionProps {
  children: React.ReactNode
  className?: string
  containerSize?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  spacing?: 'sm' | 'md' | 'lg'
}

const spacings = {
  sm: 'py-16',
  md: 'py-24',
  lg: 'py-32',
}

export function Section({ 
  children, 
  className, 
  containerSize = 'xl',
  spacing = 'md' 
}: SectionProps) {
  return (
    <section className={cn(spacings[spacing], className)}>
      <Container size={containerSize}>
        {children}
      </Container>
    </section>
  )
}