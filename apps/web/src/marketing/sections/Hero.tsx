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
        <div className="max-w-[620px] pb-10 pt-16 text-left sm:pb-12 sm:pt-28 lg:pt-32">
          <p className="mb-5 text-[13.5px] font-medium uppercase tracking-[0.14em] text-white/55 sm:mb-7 sm:text-[14px]">
            Your receptionist for roofing
          </p>

          <h1 className="text-[1.65rem] font-semibold leading-[1] tracking-[-0.03em] sm:text-[3rem] sm:leading-[0.98] sm:tracking-[-0.035em] lg:text-[3.7rem]">
            <span className="block whitespace-nowrap text-white">
              Built for every roofing conversation
            </span>
            <span className="block whitespace-nowrap text-white/70">
              Every call becomes an opportunity
            </span>
          </h1>

          <p className="mt-5 max-w-[42ch] text-pretty text-[14.5px] leading-[1.65] text-mk-secondary sm:mt-7 sm:text-[17px]">
            Answer calls. Qualify leads. Book jobs before homeowners move on.
          </p>
        </div>

        <div
          role="region"
          aria-label="Scrollable product preview"
          tabIndex={0}
          className="-mx-6 min-h-[560px] flex-1 overflow-x-auto overscroll-x-contain px-6 pb-10 [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring focus-visible:ring-offset-4 focus-visible:ring-offset-black sm:-mx-8 sm:px-8 sm:pb-12 lg:mx-0 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
        >
          <div className="w-[1040px] max-w-none lg:w-full">
            <ProductShowcase />
          </div>
        </div>
      </Container>
    </section>
  );
}
