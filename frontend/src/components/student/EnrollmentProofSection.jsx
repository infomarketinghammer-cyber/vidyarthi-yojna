import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import FileField from '../ui/FileField'
import { Alert, inputClass } from '../ui/FormField'
import SectionCard, { SubmitButton } from './SectionCard'
import { saveEnrollmentProof } from '../../services/api'
import { apiErrorMessage } from '../../utils/apiError'
import { checkUploadFile } from '../../utils/validators'

const PROOF_TYPES = ['id_card', 'marksheet', 'admit_card']

/** Section 2c — proof the student is currently enrolled: ID card, marksheet or admit card. */
export default function EnrollmentProofSection({ existing, onSaved }) {
  const { t } = useTranslation()
  const [proofType, setProofType] = useState(existing?.proof_type || PROOF_TYPES[0])
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!file && !existing) return setError(t('errors.student.enrollment_proof_required'))
    const fileError = checkUploadFile(file)
    if (fileError) return setError(t(fileError, { max_mb: 5 }))

    const data = new FormData()
    data.append('proof_type', proofType)
    if (file) data.append('proof_file', file)

    setSaving(true)
    try {
      const p = await saveEnrollmentProof(data)
      setFile(null)
      onSaved(p)
    } catch (err) {
      setError(apiErrorMessage(err, t))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard title={t('enrollmentProof.title')} description={t('enrollmentProof.desc')} saved={Boolean(existing)} savedLabel={t('onboarding.saved')}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Alert>{error}</Alert>
        <label className="block text-sm font-medium text-slate-700">
          {t('enrollmentProof.type')}
          <select value={proofType} onChange={(e) => setProofType(e.target.value)} className={inputClass}>
            {PROOF_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`enrollmentProof.types.${type}`)}
              </option>
            ))}
          </select>
        </label>
        <FileField
          label={t('enrollmentProof.file')}
          file={file}
          onChange={setFile}
          required={!existing}
          existingNote={existing ? t('onboarding.fileUploaded') : null}
        />
        <SubmitButton saving={saving} savingLabel={t('onboarding.saving')}>
          {t('enrollmentProof.save')}
        </SubmitButton>
      </form>
    </SectionCard>
  )
}
