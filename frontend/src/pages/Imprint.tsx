import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SettingsMenu from '../components/SettingsMenu'

export default function Imprint() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
        <div className="flex items-center justify-between mb-8 gap-2">
          <Link to="/" className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200">← {t('imprint.home_link')}</Link>
          <SettingsMenu />
        </div>

        <h1 className="text-3xl font-bold mb-6">{t('imprint.title')}</h1>

        <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed">
          <p>
            <span className="font-semibold text-slate-900 dark:text-slate-100">Andreas Tauböck</span><br />
            Frühstorf 13<br />
            4341 Arbing<br />
            {t('imprint.country')}
          </p>

          <p>
            {t('imprint.email_label')}:{' '}
            <a href="mailto:9v6uqtoy@anonaddy.me" className="underline hover:text-slate-900 dark:hover:text-slate-100">9v6uqtoy@anonaddy.me</a>
          </p>

          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 pt-4">{t('imprint.disclaimer_title')}</h2>

          <p>{t('imprint.disclaimer_body_1')}</p>

          <p>{t('imprint.disclaimer_body_2')}</p>

          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 pt-4">{t('imprint.liability_title')}</h2>

          <p>{t('imprint.liability_body')}</p>

          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 pt-4">{t('imprint.copyright_title')}</h2>

          <p>
            {t('imprint.copyright_body_pre')}{' '}
            <a href="https://www.gnu.org/licenses/agpl-3.0.en.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-900 dark:hover:text-slate-100">
              GNU Affero General Public License v3.0
            </a>. {t('imprint.copyright_body_mid')}{' '}
            <a href="https://github.com/andreastauboeck/ammonitor" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-900 dark:hover:text-slate-100">
              GitHub
            </a>.
          </p>
        </div>
      </div>
    </div>
  )
}
