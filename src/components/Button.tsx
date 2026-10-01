import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-primary dark:bg-primary',
  secondary:
    'bg-card dark:bg-dark-card border border-border dark:border-dark-border',
  danger: 'bg-danger dark:bg-danger',
  ghost: 'bg-transparent',
};

const VARIANT_TEXT_CLASSES: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-text dark:text-dark-text',
  danger: 'text-white',
  ghost: 'text-primary dark:text-primary',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'px-3 py-2 rounded-lg',
  md: 'px-4 py-3 rounded-xl',
  lg: 'px-5 py-4 rounded-xl',
};

const SIZE_TEXT_CLASSES: Record<Size, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

const ICON_SIZES: Record<Size, number> = {
  sm: 16,
  md: 18,
  lg: 20,
};

const DISABLED_CLASSES = 'opacity-50';

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={style}
      className={[
        'flex-row items-center justify-center',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth ? 'w-full' : '',
        isDisabled ? DISABLED_CLASSES : 'active:opacity-80',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'secondary' ? '#2563EB' : '#FFFFFF'}
        />
      ) : (
        <>
          {icon ? (
            <Ionicons
              name={icon}
              size={ICON_SIZES[size]}
              color={
                variant === 'secondary'
                  ? '#2563EB'
                  : variant === 'ghost'
                    ? '#2563EB'
                    : '#FFFFFF'
              }
              style={{ marginRight: 6 }}
            />
          ) : null}
          <Text
            style={textStyle}
            className={[
              'font-semibold',
              VARIANT_TEXT_CLASSES[variant],
              SIZE_TEXT_CLASSES[size],
            ].join(' ')}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}