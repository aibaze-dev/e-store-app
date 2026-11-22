import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Field } from '@/components/Field.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { PROJECT_BRIEF_LIMIT } from '../../../shared/project-brief.js';
import { formatProjectBrief, projectSections } from './questions.js';

export default function BriefForm({ onSend, pending, ready, error, openingFailed, onRetry }) {
  const [step, setStep] = useState(0);
  const [contact, setContact] = useState({ name: '', email: '', business: '', product: '' });
  const [answers, setAnswers] = useState({});
  const heading = useRef(null);
  const previousStep = useRef(0);
  const sections = projectSections(contact.product);
  const section = sections[step - 1];
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
        field.setCustomValidity('Please fill out this field.');
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
    <p className="brief-progress">Step {step + 1} of 4</p>
    <h3 ref={heading} tabIndex={-1} className="brief-step-title">{section?.title || 'Your project and contact details'}</h3>
    <fieldset disabled={pending} aria-label={section?.title || 'Contact details'}>
      {step === 0 ? <>
        <Field label="What did you purchase?">{props => <NativeSelect {...props} {...contactProps('product')} required>
          <option value="" disabled>Select your project type</option><option>Landing page</option><option value="Custom system">Custom system or app</option>
        </NativeSelect>}</Field>
        <Field label="Your name">{props => <Input {...props} {...contactProps('name')} autoComplete="name" maxLength={120} required />}</Field>
        <Field label="Purchase email" hint="Use the email you entered at checkout. We’ll send your project there.">{props =>
          <Input {...props} {...contactProps('email')} type="email" autoComplete="email" pattern="[^@\s]+@[^@\s]+\.[^@\s]+" maxLength={254} required />}</Field>
        <Field label="Business or brand name (optional)">{props => <Input {...props} {...contactProps('business')} autoComplete="organization" maxLength={160} />}</Field>
      </> : section.questions.map(({ key, label, hint, required }) =>
        <Field key={key} label={label + (required ? '' : ' (optional)')} hint={hint}>{props =>
          <Textarea {...props} name={key} rows={2} required={required} value={answers[key] || ''}
            onChange={event => setAnswers({ ...answers, [key]: event.target.value })} />}</Field>)}
    </fieldset>
    {step > 0 && <p className={remaining < 0 ? 'brief-error' : 'brief-budget'}>
      {remaining < 0 ? `Shorten your answers by ${-remaining} characters before sending. You can go back to edit earlier steps.` :
        `${remaining.toLocaleString('en-US')} characters left across all project answers, including labels.`}
    </p>}
    {lastStep && error && <p role="alert" className="brief-error">{error}</p>}
    {lastStep && openingFailed && <>
      <p role="alert" className="brief-error">We couldn’t connect your project. Retry the connection to send your brief.</p>
      <Button type="button" variant="outline" onClick={onRetry}>Retry connection</Button>
    </>}
    <div className="brief-actions">
      {step > 0 && <Button type="button" variant="outline" disabled={pending} onClick={() => setStep(step - 1)}>Back</Button>}
      <Button type="submit" disabled={pending || (lastStep && (!ready || remaining < 0))}>
        {lastStep ? (pending ? 'Sending…' : 'Send project brief') : 'Continue'} <ArrowRight aria-hidden="true" />
      </Button>
    </div>
  </form>;
}
