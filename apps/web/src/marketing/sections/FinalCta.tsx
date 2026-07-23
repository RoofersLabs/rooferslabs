import { Button } from '../components/Button';
import { Container } from '../components/Container';
import { Reveal } from '../components/Reveal';

/**
 * The last screen. Headline, one line, one action — the page has already made
 * its argument, and adding anything here would only give the reader somewhere
 * else to go.
 */
export function FinalCta() {
  return (
    <section className="border-t border-mk-line py-24 sm:py-36">
      <Container className="flex flex-col items-center text-center">
        <Reveal>
          <h2 className="max-w-[16ch] text-balance text-[clamp(1.95rem,5.2vw,4rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-white">
            Your phone stops being a problem today.
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mt-5 max-w-[48ch] text-pretty text-[15px] leading-[1.65] text-mk-secondary sm:mt-6 sm:text-[17px] sm:leading-[1.6]">
            Set up your number in a few minutes. The next call that comes in gets answered.
          </p>
        </Reveal>
        <Reveal delay={0.16}>
          <Button href="/sign-up" size="lg" className="mt-10">
            Get started
          </Button>
        </Reveal>
      </Container>
    </section>
  );
}
