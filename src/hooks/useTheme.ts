import { useColorScheme } from 'nativewind';

export interface ThemeInfo {
  isDark: boolean;
  scheme: 'light' | 'dark';
  toggle: () => void;
  setScheme: (scheme: 'light' | 'dark') => void;
}

export function useTheme(): ThemeInfo {
  const { colorScheme, setColorScheme, toggleColorScheme } = useColorScheme();

  const scheme: 'light' | 'dark' = colorScheme === 'dark' ? 'dark' : 'light';

  return {
    isDark: scheme === 'dark',
    scheme,
    toggle: toggleColorScheme,
    setScheme: setColorScheme,
  };
}