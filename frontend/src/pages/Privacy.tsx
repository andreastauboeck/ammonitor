import { Link } from 'react-router-dom'

export default function Privacy() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-12 md:py-16">
        <Link to="/" className="text-sm text-slate-400 hover:text-slate-200 mb-8 inline-block">← Home</Link>

        <h1 className="text-3xl font-bold mb-6">Data Privacy Policy</h1>

        <p className="text-sm text-slate-500 mb-6">Last updated: April 2026</p>

        <div className="space-y-6 text-slate-300 leading-relaxed">
          <p>
            ammonitor takes data protection seriously. This policy describes what data is processed
            when you use this website and for what purposes.
          </p>

          <h2 className="text-xl font-semibold text-slate-100">Data controller</h2>
          <p>
            Andreas Tauböck, Frühstorf 13, 4341 Arbing, Austria.<br />
            E-mail: <a href="mailto:9v6uqtoy@anonaddy.me" className="underline hover:text-slate-100">9v6uqtoy@anonaddy.me</a>
          </p>

          <h2 className="text-xl font-semibold text-slate-100">No personal data collection</h2>
          <p>
            ammonitor does not collect any personal data. There is no user registration, no login,
            no user accounts, and no tracking. We do not use cookies or any form of analytics.
          </p>

          <h2 className="text-xl font-semibold text-slate-100">Data you provide</h2>
          <p>
            When you use the calculation feature, the following data is sent to our server:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Geographic coordinates (latitude, longitude) — selected by you on the map or entered via search</li>
            <li>Calculation parameters (application method, manure properties, incorporation settings, timezone)</li>
          </ul>
          <p>
            This data is processed solely to compute the requested emission prediction and is not
            stored or logged after the response is returned.
          </p>

          <h2 className="text-xl font-semibold text-slate-100">Third-party services</h2>
          <p>When you use ammonitor, data is sent to the following external services:</p>
          <ul className="space-y-3 ml-2">
            <li>
              <span className="font-semibold text-slate-100">Nominatim (OpenStreetMap)</span> — If you search for an address, your search query is sent to the Nominatim geocoding service operated by the OpenStreetMap Foundation. See{' '}
              <a href="https://wiki.osmfoundation.org/wiki/Operations_Privacy_Policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-100">OSMF privacy policy</a>.
            </li>
            <li>
              <span className="font-semibold text-slate-100">Open-Meteo</span> — Weather forecast data is fetched from Open-Meteo based on the coordinates you select. See{' '}
              <a href="https://open-meteo.com/en/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-100">Open-Meteo terms</a>.
            </li>
            <li>
              <span className="font-semibold text-slate-100">OpenStreetMap tile server</span> — Map tiles are loaded from OpenStreetMap servers to display the map. IP addresses may be logged by the tile server. See{' '}
              <a href="https://wiki.osmfoundation.org/wiki/Operations_Privacy_Policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-100">OSMF privacy policy</a>.
            </li>
          </ul>

          <h2 className="text-xl font-semibold text-slate-100">Server logs</h2>
          <p>
            Our hosting provider (Fly.io) may log technical access data (IP address, timestamp,
            requested URL) as part of standard infrastructure operations. These logs are not
            accessible to us and are not used for tracking or profiling.
          </p>

          <h2 className="text-xl font-semibold text-slate-100">Your rights</h2>
          <p>
            Under the EU General Data Protection Regulation (GDPR), you have the right to access,
            rectification, erasure, and restriction of processing of your personal data. Since
            ammonitor does not store personal data, these rights are generally not applicable, but
            you may contact us at any time regarding data protection questions.
          </p>

          <h2 className="text-xl font-semibold text-slate-100">Changes to this policy</h2>
          <p>
            This policy may be updated from time to time. The current version is always available at
            this page.
          </p>
        </div>
      </div>
    </div>
  )
}
