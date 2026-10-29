import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import es from './es.json'
import en from './en.json'

/*
  Setup mínimo. El detector mira navegador y localStorage. Los namespaces
  reales se añadirán cuando codeemos pantallas; de momento un solo bundle
  por idioma mantiene el setup legible.
*/
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'es',
    supportedLngs: ['es', 'en'],
    interpolation: { escapeValue: false },
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
  })

export default i18n
