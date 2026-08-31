import { SiteNav } from "@/components/site-nav";
import { Hero } from "@/components/hero";
import { SectionProblem } from "@/components/section-problem";
import { SectionFeatures } from "@/components/section-features";
import { SectionCli } from "@/components/section-cli";
import { SectionValidators } from "@/components/section-validators";
import { SectionTesting } from "@/components/section-testing";
import { SectionCta } from "@/components/section-cta";
import { SiteFooter } from "@/components/site-footer";

export default function Home() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <SectionProblem />
        <SectionFeatures />
        <SectionCli />
        <SectionValidators />
        <SectionTesting />
        <SectionCta />
      </main>
      <SiteFooter />
    </>
  );
}
