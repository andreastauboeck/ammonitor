import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/LanguageSwitcher'
import ThemeSwitcher from '../components/ThemeSwitcher'

export default function Terms() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
        <div className="flex items-center justify-between mb-8 gap-2">
          <Link to="/" className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200">← {t('imprint.home_link')}</Link>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-6">{t('terms.title')}</h1>

        <p className="text-sm text-slate-500 mb-6">{t('terms.last_updated')}</p>

        <div className="space-y-6 text-slate-700 dark:text-slate-300 leading-relaxed">
          <p>{t('terms.intro')}</p>

          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('terms.purpose_title')}</h2>
          <p>{t('terms.purpose_body')}</p>

          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('terms.warranty_title')}</h2>
          <p>{t('terms.warranty_body')}</p>

          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('terms.advice_title')}</h2>
          <p>{t('terms.advice_body')}</p>

          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('terms.availability_title')}</h2>
          <p>{t('terms.availability_body')}</p>

          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('terms.license_title')}</h2>
          <p>
            {t('terms.license_body_pre')}{' '}
            <a href="https://www.gnu.org/licenses/agpl-3.0.en.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-900 dark:hover:text-slate-100">
              GNU Affero General Public License v3.0 (AGPL-3.0)
            </a>. {t('terms.license_body_mid')}{' '}
            <a href="https://github.com/andreastauboeck/ammonitor" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-900 dark:hover:text-slate-100">
              GitHub
            </a>.
          </p>

          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('terms.third_party_title')}</h2>
          <p>{t('terms.third_party_body')}</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>
              <span className="font-semibold text-slate-900 dark:text-slate-100">ALFAM2</span> — {t('terms.tp_alfam2')}{' '}
              <a href="https://projects.au.dk/alfam" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-900 dark:hover:text-slate-100">ALFAM2</a>.
            </li>
            <li>
              <span className="font-semibold text-slate-900 dark:text-slate-100">Open-Meteo</span> — {t('terms.tp_openmeteo')}{' '}
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-900 dark:hover:text-slate-100">CC BY 4.0</a>.
            </li>
            <li>
              <span className="font-semibold text-slate-900 dark:text-slate-100">Nominatim / OpenStreetMap</span> — {t('terms.tp_osm')}{' '}
              <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-900 dark:hover:text-slate-100">ODbL</a>.
            </li>
          </ul>
          <p>{t('terms.tp_after')}</p>

          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('terms.liability_title')}</h2>
          <p>{t('terms.liability_body')}</p>

          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('terms.changes_title')}</h2>
          <p>{t('terms.changes_body')}</p>

          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('terms.contact_title')}</h2>
          <p>
            Andreas Tauböck<br />
            Frühstorf 13, 4341 Arbing, {t('imprint.country')}<br />
            {t('imprint.email_label')}: <a href="mailto:9v6uqtoy@anonaddy.me" className="underline hover:text-slate-900 dark:hover:text-slate-100">9v6uqtoy@anonaddy.me</a>
          </p>
        </div>
      </div>
    </div>
  )
}
