import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Field } from '@/components/Field.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { PROJECT_BRIEF_LIMIT } from '../../../shared/project-brief.js';
import { formatProjectBrief, localizeSections, projectSections } from './questions.js';
import { useLanguage, useStrings } from '../i18n.js';
import { QUESTION_TEXT, STRINGS } from './strings.js';

export default function BriefForm({ onSend, pending, ready, error, openingFailed, onRetry }) {
  const t = useStrings(STRINGS);
  const { lang, locale } = useLanguage();
  const [step, setStep] = useState(0);
  const [contact, setContact] = useState({ name: '', email: '', business: '', product: '' });
  const [answers, setAnswers] = useState({});
  const heading = useRef(null);
  const previousStep = useRef(0);
  const sections = projectSections(contact.product);
  const section = localizeSections(sections, QUESTION_TEXT[lang])[step - 1];
  const lastStep = step === sections.length;
  const brief = formatProjectBrief(sections, answers);
  const remaining = PROJECT_BRIEF_LIMIT - brief.length;

  useEffect(() => {
    if (previousStep.current !== step) heading.current?.focus();
    previousStep.current = step;
  }, [step]);

  function contactProps(name) {
    return { name, value: contact[name], onChange: event => setContact({ ...contact, [name]: event.target.value }) };
  }

  function advance(event) {
    event.preventDefault();
    if (pending) return;
    for (const field of event.currentTarget.querySelectorAll('[required]')) {
      if (!field.value.trim()) {
        field.setCustomValidity(t.fillField);
        field.reportValidity();
        return;
      }
    }
    if (!lastStep) {
      setStep(step + 1);
    } else if (ready && remaining >= 0) {
      onSend({ ...contact, brief });
    }
  }

  return <form onSubmit={advance} onInput={event => event.target.setCustomValidity('')}>
    <p className="brief-progress">{t.step(step + 1, 4)}</p>
    <h3 ref={heading} tabIndex={-1} className="brief-step-title">{section?.title || t.contactTitle}</h3>
    <fieldset disabled={pending} aria-label={section?.title || t.contactLabel}>
      {step === 0 ? <>
        <Field label={t.purchased}>{props => <NativeSelect {...props} {...contactProps('product')} required>
          <option value="" disabled>{t.selectType}</option><option value="Landing page">{t.landing}</option><option value="Custom system">{t.custom}</option>
        </NativeSelect>}</Field>
        <Field label={t.yourName}>{props => <Input {...props} {...contactProps('name')} autoComplete="name" maxLength={120} required />}</Field>
        <Field label={t.purchaseEmail} hint={t.purchaseEmailHint}>{props =>
          <Input {...props} {...contactProps('email')} type="email" autoComplete="email" pattern="[^@\s]+@[^@\s]+\.[^@\s]+" maxLength={254} required />}</Field>
        <Field label={t.business}>{props => <Input {...props} {...contactProps('business')} autoComplete="organization" maxLength={160} />}</Field>
      </> : section.questions.map(({ key, label, hint, required }) =>
        <Field key={key} label={label + (required ? '' : t.optional)} hint={hint}>{props =>
          <Textarea {...props} name={key} rows={2} required={required} value={answers[key] || ''}
            onChange={event => setAnswers({ ...answers, [key]: event.target.value })} />}</Field>)}
    </fieldset>
    {step > 0 && <p className={remaining < 0 ? 'brief-error' : 'brief-budget'}>
      {remaining < 0 ? t.shorten(-remaining) : t.left(remaining.toLocaleString(locale))}
    </p>}
    {lastStep && error && <p role="alert" className="brief-error">{error}</p>}
    {lastStep && openingFailed && <>
      <p role="alert" className="brief-error">{t.connectError}</p>
      <Button type="button" variant="outline" onClick={onRetry}>{t.retry}</Button>
    </>}
    <div className="brief-actions">
      {step > 0 && <Button type="button" variant="outline" disabled={pending} onClick={() => setStep(step - 1)}>{t.back}</Button>}
      <Button type="submit" disabled={pending || (lastStep && (!ready || remaining < 0))}>
        {lastStep ? (pending ? t.sending : t.send) : t.continue} <ArrowRight aria-hidden="true" />
      </Button>
    </div>
  </form>;
}
