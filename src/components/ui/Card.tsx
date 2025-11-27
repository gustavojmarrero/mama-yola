import { HTMLAttributes, forwardRef, ReactNode } from 'react';

type CardVariant = 'default' | 'elevated' | 'metric' | 'section';
type MetricColor = 'lavender' | 'success' | 'warning' | 'error' | 'info';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  metricColor?: MetricColor;
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

interface CardMetricProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode;
  label: string;
  value: string | number;
  change?: { value: string; positive: boolean };
  color?: MetricColor;
}

const variantStyles: Record<CardVariant, string> = {
  default: `
    bg-white
    border border-warm-100
    rounded-2xl
    shadow-card
  `,
  elevated: `
    bg-gradient-to-br from-white to-lavender-50/30
    border border-lavender-100
    rounded-2xl
    shadow-card-elevated
  `,
  metric: `
    bg-gradient-to-br from-white via-white
    border-l-4
    rounded-xl
    shadow-soft-sm
  `,
  section: `
    bg-warm-50/50
    border border-warm-100
    rounded-2xl
  `,
};

const metricColorStyles: Record<MetricColor, string> = {
  lavender: 'border-lavender-400 to-lavender-50/50',
  success: 'border-success to-success-light/50',
  warning: 'border-warning to-warning-light/50',
  error: 'border-error to-error-light/50',
  info: 'border-info to-info-light/50',
};

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      metricColor = 'lavender',
      hoverable = false,
      padding = 'md',
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const hoverStyles = hoverable
      ? 'card-hover-shadow cursor-pointer hover:-translate-y-0.5 transition-all duration-200'
      : '';

    const colorStyles = variant === 'metric' ? metricColorStyles[metricColor] : '';

    return (
      <div
        ref={ref}
        className={`
          ${variantStyles[variant]}
          ${colorStyles}
          ${paddingStyles[padding]}
          ${hoverStyles}
          ${className}
        `.trim().replace(/\s+/g, ' ')}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ icon, title, subtitle, action, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex items-start justify-between gap-4 ${className}`}
        {...props}
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-lavender-100 flex items-center justify-center text-xl">
              {icon}
            </div>
          )}
          <div>
            <h3 className="font-display font-semibold text-warm-800 text-lg">
              {title}
            </h3>
            {subtitle && (
              <p className="text-sm text-warm-500 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

const CardMetric = forwardRef<HTMLDivElement, CardMetricProps>(
  (
    { icon, label, value, change, color = 'lavender', className = '', ...props },
    ref
  ) => {
    const iconColorStyles: Record<MetricColor, string> = {
      lavender: 'bg-lavender-100 text-lavender-600',
      success: 'bg-success-light text-success-dark',
      warning: 'bg-warning-light text-warning-dark',
      error: 'bg-error-light text-error-dark',
      info: 'bg-info-light text-info-dark',
    };

    return (
      <Card
        ref={ref}
        variant="metric"
        metricColor={color}
        padding="md"
        className={className}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-warm-500 mb-1">{label}</p>
            <p className="text-2xl font-bold text-warm-800 font-display">
              {value}
            </p>
            {change && (
              <div className="flex items-center gap-1 mt-2">
                <span
                  className={`text-sm font-medium ${
                    change.positive ? 'text-success' : 'text-error'
                  }`}
                >
                  {change.positive ? '↑' : '↓'} {change.value}
                </span>
              </div>
            )}
          </div>
          {icon && (
            <div
              className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${iconColorStyles[color]}`}
            >
              {icon}
            </div>
          )}
        </div>
      </Card>
    );
  }
);

CardMetric.displayName = 'CardMetric';

export default Card;
export { CardHeader, CardMetric };
export type { CardProps, CardHeaderProps, CardMetricProps, CardVariant, MetricColor };
