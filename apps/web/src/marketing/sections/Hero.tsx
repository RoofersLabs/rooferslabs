import { Container } from '../components/Container';
import { ProductShowcase } from '../dashboard/ProductShowcase';

/**
 * The first screen. The copy earns roughly the top third and the product takes
 * the rest — the promise is easier to believe once you can see the thing that
 * makes it.
 */
export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col bg-black pt-16">
      <Container className="flex flex-1 flex-col">
        <div className="max-w-[620px] pb-12 pt-20 text-left sm:pt-28 lg:pt-32">
          <p className="mb-6 text-[12px] font-medium uppercase tracking-[0.14em] text-white/55">
            AI receptionist for roofing teams
          </p>

          <h1 className="text-[2.125rem] font-semibold leading-[0.98] tracking-[-0.035em] sm:text-[3.5rem] lg:text-[4.25rem]">
            <span className="block whitespace-nowrap text-white">Calls answered.</span>
            <span className="block whitespace-nowrap text-white/70">Leads captured.</span>
          </h1>

          <p className="mt-7 max-w-[42ch] text-pretty text-[16px] leading-[1.65] text-mk-secondary sm:text-[17px]">
            Answer calls. Qualify leads. Book jobs before homeowners move on.
          </p>
        </div>

        <div className="min-h-[560px] flex-1 pb-10 sm:pb-12">
          <ProductShowcase />
        </div>
      </Container>
    </section>
  );
}
