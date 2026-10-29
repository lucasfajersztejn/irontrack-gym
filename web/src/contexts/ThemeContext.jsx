import { createContext, useContext } from 'react'

/*
  La app es oscura por defecto (spec §7). Este context queda preparado por
  si en algún momento se quiere alternar entre densidades o variantes de
  color, pero hoy no tiene variantes que ofrecer.
*/
const ThemeContext = createContext({ theme: 'dark' })

export function ThemeProvider({ value = { theme: 'dark' }, children }) {
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
