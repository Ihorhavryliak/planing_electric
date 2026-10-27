import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all duration-150 active:translate-y-px active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dmp-color-brand)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:translate-y-0 motion-reduce:active:scale-100',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--dmp-color-brand)] text-white shadow-sm shadow-black/10 hover:brightness-110 active:brightness-95',
        secondary:
          'border border-white/10 bg-white/[0.08] text-slate-100 shadow-sm shadow-black/20 hover:bg-white/[0.12]',
        outline:
          'border border-white/12 bg-white/[0.04] text-slate-100 shadow-sm shadow-black/20 hover:border-white/20 hover:bg-white/[0.08]',
        ghost: 'text-slate-300 hover:bg-white/[0.07] hover:text-white',
        danger:
          'bg-rose-500 text-white shadow-sm shadow-black/10 hover:bg-rose-400 active:bg-rose-600',
        link: 'text-[var(--dmp-color-brand)] underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-2.5 text-xs',
        md: 'h-10 px-4 py-2',
        lg: 'h-11 px-5 text-base',
        default: 'h-10 px-4 py-2',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
