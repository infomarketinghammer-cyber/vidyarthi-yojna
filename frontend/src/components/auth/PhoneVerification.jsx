import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import FormField, { Alert, inputClass } from '../ui/FormField'
import { sendOtp, verifyOtp } from '../../services/api'
import { apiErrorMessage } from '../../utils/apiError'
import { normalizeMobile } from '../../utils/validators'

const RESEND_SECONDS = 30
const buttonClass =
  'shrink-0 rounded-lg border border-brand-600 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50'

/**
 * Mobile number field with OTP verification.
 * `token` is the proof returned by the backend once the code is correct; the
 * parent sends it with the registration and clears it when the number changes.
 */
export default function PhoneVerification({ value, onChange, token, onVerified }) {
  const { t } = useTranslation()
  const [sentTo, setSentTo] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)

  const phone = normalizeMobile(value)

  // A different number needs its own code
  useEffect(() => {
    if (sentTo && phone !== sentTo) {
      setSentTo('')
      setCode('')
      setError('')
    }
  }, [phone, sentTo])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const send = async () => {
    setError('')
    if (!phone) return setError(t('auth.invalidPhone'))
    setBusy(true)
    try {
      await sendOtp(phone)
      setSentTo(phone)
      setCode('')
      setCooldown(RESEND_SECONDS)
    } catch (err) {
      const body = err?.response?.data
      if (body?.code === 'otp.too_soon') setCooldown(body.data?.seconds || RESEND_SECONDS)
      setError(apiErrorMessage(err, t))
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    setError('')
    if (!/^\d{6}$/.test(code)) return setError(t('auth.otp.enterCode'))
    setBusy(true)
    try {
      const { phone_token } = await verifyOtp(sentTo, code)
      onVerified(phone_token)
      setSentTo('')
    } catch (err) {
      setError(apiErrorMessage(err, t))
    } finally {
      setBusy(false)
    }
  }

  const changeNumber = () => {
    onVerified('')
    setCode('')
    setError('')
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <FormField
            label={t('auth.phone')}
            type="tel"
            inputMode="numeric"
            name="phone"
            autoComplete="tel-national"
            prefix="+91"
            placeholder="98765 43210"
            maxLength={14}
            required
            readOnly={Boolean(token)}
            value={value}
            onChange={onChange}
          />
        </div>
        {token ? (
          <button type="button" onClick={changeNumber} className={buttonClass}>
            {t('auth.otp.change')}
          </button>
        ) : (
          <button type="button" onClick={send} disabled={busy || cooldown > 0} className={buttonClass}>
            {sentTo ? (cooldown > 0 ? t('auth.otp.resendIn', { seconds: cooldown }) : t('auth.otp.resend')) : t('auth.otp.send')}
          </button>
        )}
      </div>

      {token ? (
        <p role="status" className="flex items-center gap-2 text-sm font-medium text-accent-700">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-accent-600 text-xs text-white" aria-hidden="true">
            ✓
          </span>
          {t('auth.otp.verified')}
        </p>
      ) : sentTo ? (
        <div className="rounded-lg border border-brand-100 bg-brand-50 p-4">
          <p className="text-sm text-slate-700">{t('auth.otp.sentTo', { phone: `+91 ${sentTo.slice(0, 5)} ${sentTo.slice(5)}` })}</p>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            {t('auth.otp.codeLabel')}
            <span className="flex gap-2">
              <input
                className={`${inputClass} tracking-[0.4em]`}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => {
                  // Enter verifies the code instead of submitting the whole form
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    verify()
                  }
                }}
              />
              <button
                type="button"
                onClick={verify}
                disabled={busy}
                className="mt-1 shrink-0 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
              >
                {busy ? t('auth.otp.verifying') : t('auth.otp.verify')}
              </button>
            </span>
          </label>
        </div>
      ) : (
        <p className="text-xs text-slate-500">{t('auth.otp.hint')}</p>
      )}

      <Alert>{error}</Alert>
    </div>
  )
}
