'use client';

import { createContext, useContext, useState, useCallback } from 'react';

type Theme = 'dark' | 'light';

interface ExampleThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ExampleThemeContext = createContext<ExampleThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
});

export function ExampleThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ExampleThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ExampleThemeContext.Provider>
  );
}

export function useExampleTheme() {
  return useContext(ExampleThemeContext);
}
