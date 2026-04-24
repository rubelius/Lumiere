import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { motion, HTMLMotionProps } from "framer-motion"

/* ============================================
   BUTTON VARIANTS (CVA)
   ============================================ */

const buttonVariants = cva(
  // Base styles
  "inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-100 disabled:opacity-50 disabled:pointer-events-none relative overflow-hidden group/btn",
  {
    variants: {
      variant: {
        primary: 
          "bg-primary-400 text-white hover:bg-primary-500 active:bg-primary-600 shadow-lg shadow-primary-400/20 hover:shadow-xl hover:shadow-primary-500/30",
        secondary: 
          "bg-neutral-300 text-neutral-1100 hover:bg-neutral-400 active:bg-neutral-500 shadow-md",
        ghost: 
          "bg-transparent text-neutral-900 hover:bg-neutral-300/50 hover:text-neutral-1100",
        outline: 
          "bg-transparent border border-neutral-500 text-neutral-1000 hover:bg-neutral-300/30 hover:border-neutral-600 hover:text-neutral-1100",
        destructive:
          "bg-error text-white hover:bg-error/90 active:bg-error/80 shadow-lg shadow-error/20",
        accent:
          "bg-accent-500 text-neutral-100 hover:bg-accent-600 active:bg-accent-700 shadow-lg shadow-accent-500/20 hover:shadow-xl hover:shadow-accent-600/30",
      },
      size: {
        sm: "px-3 py-1.5 text-sm",
        md: "px-4 py-2 text-base",
        lg: "px-6 py-3 text-lg",
        xl: "px-8 py-4 text-xl",
      },
      fullWidth: {
        true: "w-full",
      },
      isLoading: {
        true: "cursor-not-allowed",
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

/* ============================================
   BUTTON PROPS (Base Types)
   ============================================ */

// 1. Criamos uma interface apenas com as propriedades que você inventou
export interface BaseButtonProps extends VariantProps<typeof buttonVariants> {
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  isLoading?: boolean
  loadingText?: string
  asChild?: boolean
  withShimmer?: boolean
}

// 2. O botão normal junta os atributos nativos do HTML com os seus customizados
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    BaseButtonProps {}

// 3. O botão animado junta os atributos do Framer Motion, 
export interface MotionButtonProps 
  extends Omit<HTMLMotionProps<"button">, "children">, 
    BaseButtonProps {
  children?: React.ReactNode;
}

/* ============================================
   BUTTON COMPONENT
   ============================================ */

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  isLoading?: boolean
  loadingText?: string
  asChild?: boolean
  withShimmer?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    fullWidth,
    leftIcon, 
    rightIcon, 
    isLoading = false,
    loadingText,
    children,
    disabled,
    withShimmer = variant === "primary",
    ...props 
  }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, fullWidth, isLoading, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {/* Content wrapper */}
        <span className="relative z-10 flex items-center justify-center gap-2">
          {/* Loading spinner */}
          {isLoading && (
            <svg 
              className="animate-spin h-4 w-4" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24"
            >
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          
          {/* Left icon */}
          {!isLoading && leftIcon && (
            <span className="shrink-0">{leftIcon}</span>
          )}
          
          {/* Text */}
          <span>
            {isLoading ? (loadingText || children) : children}
          </span>
          
          {/* Right icon */}
          {!isLoading && rightIcon && (
            <span className="shrink-0">{rightIcon}</span>
          )}
        </span>
        
        {/* Shimmer effect (primary button only by default) */}
        {withShimmer && !isLoading && (
          <div className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        )}
      </button>
    )
  }
)

Button.displayName = "Button"

/* ============================================
   MOTION BUTTON (with Framer Motion)
   ============================================ */

const MotionButton = React.forwardRef<HTMLButtonElement, MotionButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    fullWidth, 
    leftIcon, 
    rightIcon, 
    isLoading = false, 
    loadingText, 
    children, 
    disabled, 
    withShimmer = variant === "primary", 
    ...props 
  }, ref) => {
    return (
      <motion.button
        className={cn(buttonVariants({ variant, size, fullWidth, isLoading, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        {...props}
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          {isLoading && (
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          
          {!isLoading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
          <span>{isLoading ? (loadingText || children) : children}</span>
          {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </span>
        
        {withShimmer && !isLoading && (
          <div className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        )}
      </motion.button>
    )
  }
)

MotionButton.displayName = "MotionButton"

export { Button, MotionButton, buttonVariants }
