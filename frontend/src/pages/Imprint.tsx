import { Link } from 'react-router-dom'

export default function Imprint() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-12 md:py-16">
        <Link to="/" className="text-sm text-slate-400 hover:text-slate-200 mb-8 inline-block">← Home</Link>

        <h1 className="text-3xl font-bold mb-6">Imprint</h1>

        <div className="space-y-4 text-slate-300 leading-relaxed">
          <p>
            <span className="font-semibold text-slate-100">Andreas Tauböck</span><br />
            Frühstorf 13<br />
            4341 Arbing<br />
            Austria
          </p>

          <p>
            E-mail:{' '}
            <a href="mailto:9v6uqtoy@anonaddy.me" className="underline hover:text-slate-100">9v6uqtoy@anonaddy.me</a>
          </p>

          <h2 className="text-xl font-semibold text-slate-100 pt-4">Disclaimer</h2>

          <p>
            The information provided by ammonitor is for general informational purposes only. All
            predictions are based on models and weather forecasts and may differ from actual
            conditions. No guarantee is made regarding the accuracy or completeness of the results.
          </p>

          <p>
            ammonitor is not a substitute for professional agricultural advice. Users should consult
            qualified advisors before making decisions based on the tool's output.
          </p>

          <h2 className="text-xl font-semibold text-slate-100 pt-4">Liability</h2>

          <p>
            The operator of this website is not liable for any damages arising from the use of the
            information or services provided, unless caused by intent or gross negligence.
          </p>

          <h2 className="text-xl font-semibold text-slate-100 pt-4">Copyright notice</h2>

          <p>
            This project is licensed under the{' '}
            <a href="https://www.gnu.org/licenses/agpl-3.0.en.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-100">
              GNU Affero General Public License v3.0
            </a>. Source code available on{' '}
            <a href="https://github.com/andreastauboeck/ammonitor" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-100">
              GitHub
            </a>.
          </p>
        </div>
      </div>
    </div>
  )
}
