// Theme context (placeholder, dark only for now).

import { createContext, useContext } from 'react'

const ThemeContext = createContext({ theme: 'dark' })

export function ThemeProvider({ value = { theme: 'dark' }, children }) {
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
