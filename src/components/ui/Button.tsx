import { ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-gradient-to-r from-lavender-500 to-lavender-600
    text-white font-semibold
    shadow-btn-primary
    hover:shadow-btn-primary-hover
    hover:from-lavender-600 hover:to-lavender-700
    active:scale-[0.98]
    disabled:from-lavender-300 disabled:to-lavender-400
    disabled:shadow-none
  `,
  secondary: `
    bg-white
    border-2 border-lavender-200
    text-lavender-700 font-semibold
    hover:bg-lavender-50
    hover:border-lavender-300
    active:bg-lavender-100
    disabled:bg-warm-50
    disabled:border-warm-200
    disabled:text-warm-400
  `,
  ghost: `
    bg-transparent
    text-lavender-600 font-medium
    hover:bg-lavender-50
    active:bg-lavender-100
    disabled:text-warm-400
    disabled:hover:bg-transparent
  `,
  danger: `
    bg-gradient-to-r from-error to-error-dark
    text-white font-semibold
    shadow-btn-danger
    hover:from-error-dark hover:to-red-700
    active:scale-[0.98]
    disabled:from-red-300 disabled:to-red-400
    disabled:shadow-none
  `,
  success: `
    bg-gradient-to-r from-success to-success-dark
    text-white font-semibold
    shadow-[0_4px_14px_-3px_rgba(16,185,129,0.4)]
    hover:from-success-dark hover:to-emerald-700
    active:scale-[0.98]
    disabled:from-emerald-300 disabled:to-emerald-400
    disabled:shadow-none
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm rounded-lg gap-1.5',
  md: 'px-6 py-3 text-base rounded-xl gap-2',
  lg: 'px-8 py-4 text-lg rounded-xl gap-2.5',
};

const Spinner = ({ className = '' }: { className?: string }) => (
  <svg
    className={`animate-spin ${className}`}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
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
);

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = '',
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center
          transition-all duration-200
          disabled:cursor-not-allowed disabled:opacity-70
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lavender-400 focus-visible:ring-offset-2
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `.trim().replace(/\s+/g, ' ')}
        {...props}
      >
        {isLoading ? (
          <>
            <Spinner className={size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'} />
            <span>Cargando...</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
export type { ButtonProps, ButtonVariant, ButtonSize };
