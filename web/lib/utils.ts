import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toBoolean(value: unknown) {
  return value === true || value === 1 || value === '1' || value === 'true'
}
