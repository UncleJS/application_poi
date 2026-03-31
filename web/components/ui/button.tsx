'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 text-sm font-semibold transition-colors shadow-md disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  {
    variants: {
      variant: {
        default: 'border-teal-500 bg-teal-500 text-zinc-950 shadow-teal-950/60 hover:border-teal-400 hover:bg-teal-400 disabled:border-teal-700 disabled:bg-teal-800 disabled:text-teal-100',
        secondary: 'border-zinc-500 bg-zinc-700 text-white shadow-black/40 hover:border-zinc-400 hover:bg-zinc-600 disabled:border-zinc-600 disabled:bg-zinc-700 disabled:text-zinc-300',
        outline: 'border-zinc-500 bg-zinc-800 text-white shadow-black/40 hover:border-zinc-400 hover:bg-zinc-700 disabled:border-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-300',
        ghost: 'border-zinc-600 bg-zinc-900 text-zinc-100 shadow-black/30 hover:border-zinc-500 hover:bg-zinc-800 disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-400',
        destructive: 'border-red-500 bg-red-600 text-white shadow-red-950/60 hover:border-red-400 hover:bg-red-500 disabled:border-red-700 disabled:bg-red-800 disabled:text-red-100'
      },
      size: {
        default: 'h-11 min-w-28 px-5 py-2',
        sm: 'h-10 min-w-24 rounded-lg px-4',
        lg: 'h-12 px-6',
        icon: 'h-10 w-10 min-w-10'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
