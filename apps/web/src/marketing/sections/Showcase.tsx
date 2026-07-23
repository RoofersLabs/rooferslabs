import { Container } from '../components/Container';
import { Reveal } from '../components/Reveal';
import { ProductShowcase } from '../dashboard/ProductShowcase';

export function Showcase() {
  return (
    <section id="product" className="scroll-mt-24 py-20 sm:py-24">
      <Container>
        <Reveal>
          <h2 className="max-w-[20ch] text-balance text-[clamp(2rem,4.2vw,3.25rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
            The front office, running itself.
          </h2>
          <p className="mt-5 max-w-[58ch] text-pretty text-[16.5px] leading-[1.65] text-mk-secondary">
            Every call becomes a record: a transcript, a qualified lead, a booked slot, and a
            notification that reaches whoever needs it. This is the real interface — open a call,
            change the day, look around.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-14">
          <ProductShowcase />
        </Reveal>
      </Container>
    </section>
  );
}
