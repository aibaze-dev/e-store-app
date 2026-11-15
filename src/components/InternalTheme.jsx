import { createContext, useContext, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

const STORAGE_KEY = 'ebook-panel-theme';
const ThemeContext = createContext(null);

function initialTheme() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

// Shares a preference without applying a theme to the public storefront.
export function InternalThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The switch still works in this session when storage is unavailable.
    }
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function InternalTheme({ children, className, fullHeight = true }) {
  const { theme } = useContext(ThemeContext);
  return <div data-internal-theme={theme} className={cn(
    'internal-theme bg-background text-foreground',
    theme === 'dark' && 'dark',
    fullHeight && 'min-h-svh',
    className,
  )}>{children}</div>;
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const label = theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  const Icon = theme === 'dark' ? Sun : Moon;
  return <Button type="button" variant="outline" size="icon" onClick={toggleTheme} aria-label={label} title={label}>
    <Icon aria-hidden="true" />
  </Button>;
}
