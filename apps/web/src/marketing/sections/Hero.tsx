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
          {/* The product announcement. It occupies the eyebrow's slot and keeps
              its margins, so the headline below starts exactly where it always
              did — a status pill rather than a section label, built from the
              same tokens as the pricing card's badge. */}
          <a
            href="#product"
            className="group mb-5 inline-flex items-center gap-2 rounded-full border border-mk-line-strong bg-white/[0.045] py-1 pl-3 pr-2.5 text-[11.5px] font-medium tracking-[0.01em] text-white/85 transition-colors duration-200 ease-smooth hover:border-white/25 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring focus-visible:ring-offset-4 focus-visible:ring-offset-black sm:mb-7 sm:text-[12.5px]"
          >
            <span aria-hidden="true" className="h-[5px] w-[5px] rounded-full bg-mk-accent-fg" />
            Introducing r1 echo
            <span
              aria-hidden="true"
              className="text-white/50 transition-transform duration-200 ease-smooth group-hover:translate-x-0.5 motion-reduce:transform-none"
            >
              &rarr;
            </span>
          </a>

          <h1 className="text-[1.65rem] font-semibold leading-[1] tracking-[-0.03em] sm:text-[3rem] sm:leading-[0.98] sm:tracking-[-0.035em] lg:text-[3.7rem]">
            <span className="block whitespace-nowrap text-white">
              Built for every roofing conversation
            </span>
            <span className="block whitespace-nowrap text-white/70">
              Every call becomes an opportunity
            </span>
          </h1>

          <p className="mt-5 max-w-[42ch] text-pretty text-[14.5px] leading-[1.65] text-mk-secondary sm:mt-7 sm:text-[17px]">
            Every call answered, every lead qualified, every job booked — an intelligent front desk
            built for roofing companies.
          </p>
        </div>

        {/* The preview used to be a fixed 1040px canvas dragged sideways in a
            horizontal scroller below `lg`, because the old mock-up had one
            desktop layout and no other. It does not any more: it rebuilds
            itself at each breakpoint the way the application does — sidebar to
            drawer, table to list, four columns to two — so it simply takes the
            width it is given. */}
        <div className="flex-1 pb-10 sm:pb-12">
          <ProductShowcase />
        </div>
      </Container>
    </section>
  );
}
