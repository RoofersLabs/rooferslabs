import { Building2, Clock, Languages, MapPin, Sparkles } from 'lucide-react';
import { Container, Section } from '../components/Section';
import { RevealGroup, RevealItem } from '../components/Reveal';

/**
 * Trust without borrowed credibility.
 *
 * A wall of invented customer logos is the fastest way to lose a contractor who
 * knows the market, so this states what is verifiably true about the product
 * instead. Swap in real logos here once there are named references to use.
 */
const CLAIMS = [
  { icon: Building2, label: 'Built only for roofing contractors' },
  { icon: Clock, label: '24/7 AI receptionist' },
  { icon: MapPin, label: 'Works nationwide' },
  { icon: Languages, label: 'Natural English-speaking AI' },
  { icon: Sparkles, label: 'Trained on roofing terminology' },
];

export function SocialProof() {
  return (
    <Section tone="subtle" bordered glow="top" className="py-14 sm:py-16 lg:py-20">
      <Container>
        <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-mkt-ink-faint">
          Purpose-built for the trade
        </p>
        <RevealGroup className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
          {CLAIMS.map(({ icon: Icon, label }) => (
            <RevealItem key={label} className="flex flex-col items-center gap-2.5 text-center">
              <Icon className="h-5 w-5 text-mkt-accent" aria-hidden />
              <span className="text-[0.8125rem] font-medium leading-snug text-mkt-ink-muted">
                {label}
              </span>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </Section>
  );
}
