// Legal links footer.
import { Trans } from 'react-i18next'

export default function LegalFooter() {
  return (
    <p className="text-center text-xs text-text-muted">
      <Trans
        i18nKey="landing.legal"
        components={{
          terms: (
            <a href="#" className="-my-1 inline-block py-1 text-link hover:underline" />
          ),
          privacy: (
            <a href="#" className="-my-1 inline-block py-1 text-link hover:underline" />
          ),
        }}
      />
    </p>
  )
}
