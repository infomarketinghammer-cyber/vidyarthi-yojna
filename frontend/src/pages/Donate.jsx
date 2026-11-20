import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import DonateBank from '../components/DonateBank'
import FormField, { Alert, inputClass } from '../components/ui/FormField'
import { createDonationOrder, donationReceiptUrl, verifyDonationPayment } from '../services/api'
import { apiErrorMessage } from '../utils/apiError'
import { formatRupees } from '../utils/format'
import { normalizeMobile, panError } from '../utils/validators'

const PRESETS = [500, 1000, 3500, 5000] // ₹3,500 ≈ one student's meals for a month
const EMPTY = { name: '', address: '', pan: '', phone: '', email: '', amount: '3500' }
const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

/** Loads Razorpay Checkout once, the first time a donor goes to pay. */
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = CHECKOUT_SRC
    script.onload = resolve
    script.onerror = reject
    document.body.appendChild(script)
  })
}

function Steps({ step }) {
  const { t } = useTranslation()
  const steps = ['details', 'payment']
  const current = step === 'done' ? 2 : steps.indexOf(step)
  return (
    <ol className="flex items-center gap-3 text-sm">
      {steps.map((key, i) => (
        <li key={key} className="flex items-center gap-2">
          <span
            className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
              i < current ? 'bg-accent-600 text-white' : i === current ? 'bg-brand-gradient text-white' : 'bg-slate-200 text-slate-500'
            }`}
            aria-hidden="true"
          >
            {i < current ? '✓' : i + 1}
          </span>
          <span className={i === current ? 'font-semibold text-slate-800' : 'text-slate-500'}>{t(`donatePage.steps.${key}`)}</span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-8 bg-slate-300" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  )
}

/** Public donation page: bank details for transfers, then an online donation through Razorpay. */
export default function Donate() {
  const { t, i18n } = useTranslation()
  const rupees = (n) => formatRupees(n, i18n.language)

  const [step, setStep] = useState('details')
  const [form, setForm] = useState(EMPTY)
  const [order, setOrder] = useState(null) // reused if the donor retries the same payment
  const [donation, setDonation] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const amount = Number(form.amount)
  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const toPayment = (e) => {
    e.preventDefault()
    setError('')
    if (form.name.trim().length < 2) return setError(t('donatePage.errors.name'))
    if (form.address.trim().length < 10) return setError(t('donatePage.errors.address'))
    const panKey = panError(form.pan)
    if (panKey) return setError(t(panKey))
    if (!normalizeMobile(form.phone)) return setError(t('auth.invalidPhone'))
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return setError(t('donatePage.errors.email'))
    if (!Number.isInteger(amount) || amount < 1) return setError(t('donatePage.errors.amount'))
    setOrder(null) // details may have changed since the last order
    setStep('payment')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const pay = async () => {
    setError('')
    setBusy(true)
    try {
      const current =
        order ||
        (await createDonationOrder({
          name: form.name.trim(),
          address: form.address.trim(),
          pan: form.pan.replace(/\s/g, '').toUpperCase(),
          phone: normalizeMobile(form.phone),
          email: form.email.trim(),
          amount,
        }))
      setOrder(current)
      await loadCheckout()

      const checkout = new window.Razorpay({
        key: current.key_id,
        order_id: current.order_id,
        amount: current.amount,
        currency: current.currency,
        name: t('app.name'),
        description: t('donatePage.checkoutDescription'),
        image: `${window.location.origin}/brand/logo-sm.png`,
        prefill: { name: current.name, email: current.email, contact: `+91${current.phone}` },
        theme: { color: '#ca0853' },
        handler: async (response) => {
          try {
            setDonation(await verifyDonationPayment(response))
            setStep('done')
            window.scrollTo({ top: 0, behavior: 'smooth' })
          } catch (err) {
            setError(apiErrorMessage(err, t))
          } finally {
            setBusy(false)
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      })
      checkout.on('payment.failed', (res) => {
        setError(t('donatePage.failed', { reason: res.error?.description || '' }))
        setBusy(false)
      })
      checkout.open()
    } catch (err) {
      setError(err?.response ? apiErrorMessage(err, t) : t('donatePage.checkoutLoadFailed'))
      setBusy(false)
    }
  }

  const summary = [
    [t('donatePage.fields.name'), form.name.trim()],
    [t('donatePage.fields.address'), form.address.trim()],
    [t('donatePage.fields.pan'), form.pan.replace(/\s/g, '').toUpperCase()],
    [t('donatePage.fields.phone'), `+91 ${normalizeMobile(form.phone) || ''}`],
    [t('donatePage.fields.email'), form.email.trim()],
  ]

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-bold text-brand-700 sm:text-4xl">{t('donatePage.title')}</h1>
        <p className="mt-3 leading-relaxed text-slate-700">{t('donatePage.subtitle')}</p>
      </header>

      <DonateBank />

      <section aria-labelledby="online-title" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="online-title" className="text-xl font-bold text-brand-700">
              {t('donatePage.onlineTitle')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{t('donatePage.onlineBody')}</p>
          </div>
          <Steps step={step} />
        </div>

        <div className="mt-6">
          <Alert>{error}</Alert>
        </div>

        {step === 'details' && (
          <form onSubmit={toPayment} className="mt-4 space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t('donatePage.fields.name')} name="name" autoComplete="name" required value={form.name} onChange={onChange} />
              <FormField
                label={t('donatePage.fields.pan')}
                name="pan"
                required
                maxLength={10}
                autoCapitalize="characters"
                placeholder="ABCPE1234F"
                hint={t('donatePage.panHint')}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono uppercase focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                value={form.pan}
                onChange={onChange}
              />
            </div>
            <label className="block text-sm font-medium text-slate-700">
              {t('donatePage.fields.address')}
              <textarea
                name="address"
                rows={3}
                required
                maxLength={300}
                autoComplete="street-address"
                className={inputClass}
                value={form.address}
                onChange={onChange}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label={t('donatePage.fields.phone')}
                type="tel"
                inputMode="numeric"
                name="phone"
                autoComplete="tel-national"
                prefix="+91"
                placeholder="98765 43210"
                maxLength={14}
                required
                value={form.phone}
                onChange={onChange}
              />
              <FormField
                label={t('donatePage.fields.email')}
                type="email"
                name="email"
                autoComplete="email"
                required
                hint={t('donatePage.emailHint')}
                value={form.email}
                onChange={onChange}
              />
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-slate-700">{t('donatePage.fields.amount')}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRESETS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={amount === value}
                    onClick={() => setForm((f) => ({ ...f, amount: String(value) }))}
                    className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                      amount === value ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-700 hover:border-brand-300'
                    }`}
                  >
                    {rupees(value)}
                  </button>
                ))}
                <span className="flex items-center rounded-lg border border-slate-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
                  <span className="px-3 text-slate-500">₹</span>
                  <input
                    name="amount"
                    inputMode="numeric"
                    aria-label={t('donatePage.otherAmount')}
                    placeholder={t('donatePage.otherAmount')}
                    className="w-32 rounded-r-lg py-2 pr-3 focus:outline-none"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value.replace(/\D/g, '') }))}
                  />
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">{t('donatePage.amountHint')}</p>
            </fieldset>

            <button type="submit" className="w-full rounded-lg bg-brand-gradient px-5 py-3 font-semibold text-white hover:brightness-110 sm:w-auto">
              {t('donatePage.continue')} →
            </button>
          </form>
        )}

        {step === 'payment' && (
          <div className="mt-4 grid gap-6 md:grid-cols-[1fr_auto]">
            <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
              {summary.map(([label, value]) => (
                <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="break-words font-medium text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="rounded-xl bg-brand-50 p-5 md:w-80">
              <p className="text-sm text-slate-600">{t('donatePage.youAreDonating')}</p>
              <p className="mt-1 text-3xl font-bold text-brand-700">{rupees(amount)}</p>
              <button
                type="button"
                onClick={pay}
                disabled={busy}
                className="mt-5 w-full rounded-lg bg-brand-gradient px-5 py-3 font-semibold text-white hover:brightness-110 disabled:opacity-60"
              >
                {busy ? t('donatePage.processing') : t('donatePage.pay', { amount: rupees(amount) })}
              </button>
              <p className="mt-3 text-xs leading-relaxed text-slate-600">{t('donatePage.secureNote')}</p>
              <button
                type="button"
                onClick={() => {
                  setError('')
                  setStep('details')
                }}
                disabled={busy}
                className="mt-3 text-sm font-medium text-brand-600 hover:underline disabled:opacity-50"
              >
                ← {t('donatePage.edit')}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && donation && (
          <div className="mt-4 rounded-xl bg-accent-50 p-6 text-center sm:p-10">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent-600 text-2xl text-white" aria-hidden="true">
              ✓
            </span>
            <h3 className="mt-4 text-2xl font-bold text-accent-700">{t('donatePage.thanks', { name: donation.donor_name })}</h3>
            <p className="mx-auto mt-2 max-w-xl text-slate-700">{t('donatePage.thanksBody', { amount: rupees(donation.amount) })}</p>
            {donation.receipt_emailed && donation.email && (
              <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">{t('donatePage.receiptEmailed', { email: donation.email })}</p>
            )}
            <dl className="mx-auto mt-5 grid max-w-md gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">{t('donatePage.receiptNo')}</dt>
                <dd className="font-mono font-medium text-slate-800">{donation.receipt_no}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">{t('donatePage.paymentId')}</dt>
                <dd className="font-mono font-medium text-slate-800">{donation.payment_id}</dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a
                href={donationReceiptUrl(donation.id, donation.receipt_token)}
                className="rounded-lg bg-accent-600 px-5 py-2.5 font-semibold text-white hover:bg-accent-700"
              >
                ↓ {t('donatePage.downloadReceipt')}
              </a>
              <Link to="/" className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50">
                {t('donatePage.backHome')}
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
