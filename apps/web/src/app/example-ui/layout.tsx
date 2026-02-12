'use client';

import { ExampleThemeProvider, useExampleTheme } from './components/example-theme-context';

function ExampleUILayoutInner({ children }: { children: React.ReactNode }) {
  const { theme } = useExampleTheme();
  const dark = theme === 'dark';

  return (
    <div className={`min-h-screen ${dark ? 'bg-[#0B0F1A] text-white' : 'bg-gray-50 text-gray-900'}`}>
      {children}
    </div>
  );
}

export default function ExampleUILayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ExampleThemeProvider>
      <ExampleUILayoutInner>{children}</ExampleUILayoutInner>
    </ExampleThemeProvider>
  );
}
