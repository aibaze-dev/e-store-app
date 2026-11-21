import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BackPopupContent({ copy, onAccept, onDecline, Title = "h2", Description = "p" }) {
 return <>
      <div className="space-y-3 pr-8">
        <Title className="text-2xl font-semibold tracking-tight">{copy.modalTitle}</Title>
        <Description className="leading-7 text-muted-foreground">{copy.modalSubtitle}</Description>
      </div>
      <div className="grid gap-2">
        <Button type="button" size="lg" className="h-auto min-h-12 w-full py-3 text-base whitespace-normal" onClick={onAccept}>{copy.acceptText}<ArrowRight aria-hidden="true" /></Button>
        <Button type="button" variant="ghost" className="h-auto min-h-11 w-full whitespace-normal" onClick={onDecline}>{copy.declineText}</Button>
      </div>
 </>;
}
