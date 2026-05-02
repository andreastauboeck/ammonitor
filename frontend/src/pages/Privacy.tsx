import { Link } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import SettingsMenu from '../components/SettingsMenu'

export default function Privacy() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
        <div className="flex items-center justify-between mb-8 gap-2">
          <Link to="/" className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200">← {t('imprint.home_link')}</Link>
          <SettingsMenu />
        </div>

        <h1 className="text-3xl font-bold mb-6">{t('privacy.title')}</h1>

        <p className="text-sm text-slate-500 mb-6">{t('privacy.last_updated')}</p>

        <div className="space-y-6 text-slate-700 dark:text-slate-300 leading-relaxed">
          <p>{t('privacy.intro')}</p>

          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('privacy.controller_title')}</h2>
          <p>
            Andreas Tauböck, Frühstorf 13, 4341 Arbing, {t('imprint.country')}.<br />
            {t('imprint.email_label')}: <a href="mailto:9v6uqtoy@anonaddy.me" className="underline hover:text-slate-900 dark:hover:text-slate-100">9v6uqtoy@anonaddy.me</a>
          </p>

          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('privacy.no_personal_title')}</h2>
          <p>{t('privacy.no_personal_body')}</p>

          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('privacy.data_provide_title')}</h2>
          <p>{t('privacy.data_provide_body')}</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>{t('privacy.data_provide_item_1')}</li>
            <li>{t('privacy.data_provide_item_2')}</li>
          </ul>
          <p>{t('privacy.data_provide_after')}</p>

          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('privacy.third_party_title')}</h2>
          <p>{t('privacy.third_party_body')}</p>
          <ul className="space-y-3 ml-2">
            <li>
              <span className="font-semibold text-slate-900 dark:text-slate-100">Nominatim (OpenStreetMap)</span> — <Trans i18nKey="privacy.tp_nominatim">
                If you search for an address, your search query is sent to the Nominatim geocoding service operated by the OpenStreetMap Foundation. See <a href="https://wiki.osmfoundation.org/wiki/Operations_Privacy_Policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-900 dark:hover:text-slate-100">OSMF privacy policy</a>.
              </Trans>
            </li>
            <li>
              <span className="font-semibold text-slate-900 dark:text-slate-100">Open-Meteo</span> — <Trans i18nKey="privacy.tp_openmeteo">
                Weather forecast data is fetched from Open-Meteo based on the coordinates you select. See <a href="https://open-meteo.com/en/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-900 dark:hover:text-slate-100">Open-Meteo terms</a>.
              </Trans>
            </li>
            <li>
              <span className="font-semibold text-slate-900 dark:text-slate-100">OpenStreetMap tile server</span> — <Trans i18nKey="privacy.tp_osm_tiles">
                Map tiles are loaded from OpenStreetMap servers to display the map. IP addresses may be logged by the tile server. See <a href="https://wiki.osmfoundation.org/wiki/Operations_Privacy_Policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-900 dark:hover:text-slate-100">OSMF privacy policy</a>.
              </Trans>
            </li>
            <li>
              <span className="font-semibold text-slate-900 dark:text-slate-100">GoatCounter</span> — <Trans i18nKey="privacy.tp_goatcounter">
                We use <a href="https://www.goatcounter.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-900 dark:hover:text-slate-100">GoatCounter</a>, a privacy-friendly web analytics service. GoatCounter does not use cookies, does not collect personal data, and does not track users across sites. Only anonymized page views are counted. See <a href="https://www.goatcounter.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-900 dark:hover:text-slate-100">GoatCounter privacy policy</a>.
              </Trans>
            </li>
          </ul>

          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('privacy.logs_title')}</h2>
          <p>{t('privacy.logs_body')}</p>

          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('privacy.rights_title')}</h2>
          <p>{t('privacy.rights_body')}</p>

          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('privacy.changes_title')}</h2>
          <p>{t('privacy.changes_body')}</p>
        </div>
      </div>
    </div>
  )
}
