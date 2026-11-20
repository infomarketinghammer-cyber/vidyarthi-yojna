import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getAdminOverview } from '../../services/api'
import { apiErrorMessage } from '../../utils/apiError'
import { formatNumber, formatRupees } from '../../utils/format'
import { Alert } from '../ui/FormField'

const STATUS_ORDER = ['approved', 'review', 'action', 'incomplete', 'not_eligible']
const STATUS_BAR = {
  approved: 'bg-accent-600',
  review: 'bg-brand-500',
  action: 'bg-amber-500',
  incomplete: 'bg-slate-400',
  not_eligible: 'bg-red-500',
}
const GENDER_ORDER = ['female', 'male', 'other', '']
const GENDER_BAR = { female: 'bg-brand-500', male: 'bg-accent-600', other: 'bg-amber-500', '': 'bg-slate-400' }

function StatCard({ label, value, note }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-brand-700">{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  )
}

/** Labelled horizontal bars; each row shows its count and share of the total. */
function BreakdownCard({ title, rows, total, empty }) {
  const { i18n } = useTranslation()
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-800">{title}</h2>
      {total === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
          {rows.map(({ key, label, sub, count, bar }) => (
            <li key={key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-slate-700">
                  {label}
                  {sub && <span className="ml-1 text-xs text-slate-400">{sub}</span>}
                </span>
                <span className="shrink-0 font-semibold text-slate-800">
                  {formatNumber(count, i18n.language)}
                  <span className="ml-1 text-xs font-normal text-slate-400">{Math.round((count / total) * 100)}%</span>
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${bar}`} style={{ width: `${(count / total) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Admin dashboard cards: students (by status, gender, taluka), donors and money received. */
export default function AdminOverview() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getAdminOverview()
      .then(setData)
      .catch((err) => setError(apiErrorMessage(err, t)))
  }, [t])

  const count = (n) => (data ? formatNumber(n, lang) : '—')
  const total = data?.students ?? 0

  return (
    <div className="space-y-4">
      <Alert>{error}</Alert>
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('adminOverview.students')} value={count(data?.students)} />
        <StatCard
          label={t('adminOverview.donors')}
          value={count(data?.donors)}
          note={data ? t('adminOverview.donationsCount', { count: data.donations_count, formatted: formatNumber(data.donations_count, lang) }) : ''}
        />
        <StatCard label={t('adminOverview.amountReceived')} value={data ? formatRupees(data.amount_received, lang) : '—'} />
      </section>

      {data && (
        <div className="grid gap-4 lg:grid-cols-3">
          <BreakdownCard
            title={t('adminOverview.applicationStatus')}
            total={total}
            empty={t('adminOverview.noStudents')}
            rows={STATUS_ORDER.map((key) => ({
              key,
              label: t(`adminOverview.status.${key}`),
              count: data.application_status[key] || 0,
              bar: STATUS_BAR[key],
            }))}
          />
          <BreakdownCard
            title={t('adminOverview.genderWise')}
            total={total}
            empty={t('adminOverview.noStudents')}
            rows={GENDER_ORDER.filter((key) => key || data.gender['']).map((key) => ({
              key: key || 'unknown',
              label: key ? t(`details.genders.${key}`) : t('adminOverview.notGiven'),
              count: data.gender[key] || 0,
              bar: GENDER_BAR[key],
            }))}
          />
          <BreakdownCard
            title={t('adminOverview.talukaWise')}
            total={total}
            empty={t('adminOverview.noStudents')}
            rows={data.taluka.map(({ taluka, district, count: n }) => ({
              key: `${taluka}|${district}`,
              label: taluka || t('adminOverview.talukaMissing'),
              sub: district,
              count: n,
              bar: taluka ? 'bg-brand-500' : 'bg-slate-400',
            }))}
          />
        </div>
      )}
    </div>
  )
}
