import React from 'react';
import { Button as ModernButton } from './ui/button';

interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'gradient' | 'success' | 'warning' | 'danger';
  size?: 'default' | 'sm' | 'lg' | 'xl' | 'icon';
}

export const Button: React.FC<ButtonProps> = ({
  onClick,
  children,
  className = "",
  disabled = false,
  variant = "gradient",
  size = "lg"
}) => {
  return (
    <ModernButton
      onClick={onClick}
      disabled={disabled}
      className={className}
      variant={variant}
      size={size}
    >
      {children}
    </ModernButton>
  );
};