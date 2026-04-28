import { useEffect, useMemo, useState } from "react";
import { heroSlides } from "../data/home-content";

const AUTOPLAY_MS = 5000;
const galleryModules = import.meta.glob(
  "../assets/wallpaper/home/gallery/*.{png,jpg,jpeg,webp,avif}",
  {
    eager: true,
    import: "default",
  },
);

export default function Gallery() {
  const imageSources = useMemo(
    () =>
      Object.entries(galleryModules)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([, source]) => source),
    [],
  );
  const slides = useMemo(() => {
    if (imageSources.length === 0) {
      return [];
    }

    return heroSlides.map((content, index) => ({
      ...content,
      src: imageSources[index % imageSources.length],
    }));
  }, [imageSources]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setCurrentIndex((previousIndex) => (previousIndex + 1) % slides.length);
    }, AUTOPLAY_MS);

    return () => window.clearInterval(intervalId);
  }, [slides.length]);

  if (slides.length === 0) {
    return null;
  }

  const goToPrevious = () => {
    setCurrentIndex((previousIndex) =>
      previousIndex === 0 ? slides.length - 1 : previousIndex - 1,
    );
  };

  const goToNext = () => {
    setCurrentIndex((previousIndex) => (previousIndex + 1) % slides.length);
  };

  return (
    <section className="relative min-h-[100svh] w-full overflow-hidden bg-[#141518]">
      <div
        className="flex min-h-[100svh] transition-transform duration-1000 ease-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {slides.map((slide, index) => (
          <div
            key={`${slide.heading}-${index}`}
            className="relative min-h-[100svh] min-w-full overflow-hidden bg-[#141518]"
          >
            <img
              src={slide.src}
              alt={`Rebelco gallery slide ${index + 1}`}
              className={`h-[100svh] w-full object-cover object-center transition-transform duration-[5000ms] ease-linear ${
                index === currentIndex ? "scale-105" : "scale-100"
              }`}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,244,226,0.16),transparent_28%)]" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0d]/78 via-[#0b0b0d]/32 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0d]/82 via-transparent to-[#0b0b0d]/40" />
          </div>
        ))}
      </div>

      <div className="absolute inset-x-0 top-0 z-10 h-40 bg-gradient-to-b from-black/45 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-gradient-to-b from-transparent via-[#0f0f10]/70 to-[#0f0f10] sm:h-44 lg:h-56" />

      <div className="absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 items-center justify-between px-3 sm:px-6">
        <button
          type="button"
          onClick={goToPrevious}
          aria-label="Previous slide"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/25 text-xl text-white backdrop-blur-md transition hover:bg-black/45 sm:h-12 sm:w-12 sm:text-2xl"
        >
          &#8249;
        </button>
        <button
          type="button"
          onClick={goToNext}
          aria-label="Next slide"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/25 text-xl text-white backdrop-blur-md transition hover:bg-black/45 sm:h-12 sm:w-12 sm:text-2xl"
        >
          &#8250;
        </button>
      </div>

      <div className="pointer-events-none absolute inset-0 z-20 flex items-end">
        <div className="flex w-full items-end px-3 pb-16 pt-24 sm:px-8 sm:pb-24 sm:pt-28 lg:px-16 lg:pb-32">
          <div className="w-full max-w-3xl sm:ml-4 lg:ml-12">
            <div
              key={currentIndex}
              className="pointer-events-auto w-full max-w-[44rem] max-h-[calc(100svh-8rem)] overflow-y-auto rounded-[20px] border border-white/12 bg-[linear-gradient(180deg,rgba(8,8,10,0.28),rgba(8,8,10,0.54))] px-4 py-4 text-[#f6ead6] shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-md sm:max-h-[calc(100svh-10rem)] sm:rounded-[24px] sm:px-8 sm:py-8 lg:max-h-[calc(100svh-12rem)] lg:px-12 lg:py-10"
            >
              <div className="mb-4 h-px w-16 bg-white/60 sm:mb-6 sm:w-24" />
              <div
                className="text-[10px] uppercase tracking-[0.28em] text-white/75 sm:text-sm"
                style={{ fontFamily: '"Cinzel", Georgia, serif' }}
              >
                {slides[currentIndex].eyebrow}
              </div>
              <h1
                className="mt-3 max-w-2xl text-[2rem] leading-[0.94] tracking-[0.01em] text-[#fff7eb] sm:mt-4 sm:text-5xl lg:text-7xl"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                {slides[currentIndex].heading}
              </h1>
              <p
                className="mt-3 max-w-2xl text-[14px] leading-6 text-[#eee1cf] sm:mt-4 sm:text-lg sm:leading-8 lg:text-xl lg:leading-9"
                style={{ fontFamily: '"Alegreya", Georgia, serif' }}
              >
                {slides[currentIndex].body}
              </p>

              {slides[currentIndex].ctaHref ? (
                <a
                  href={slides[currentIndex].ctaHref}
                  className="mt-5 inline-flex w-full items-center justify-center border border-white/18 bg-black px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-white transition duration-200 hover:border-white hover:bg-white hover:text-black sm:mt-8 sm:w-auto sm:px-10 sm:py-4 sm:text-sm lg:px-12 lg:py-5"
                  style={{ fontFamily: '"Cinzel", Georgia, serif' }}
                >
                  {slides[currentIndex].ctaLabel}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center gap-2 sm:bottom-8">
        {slides.map((slide, index) => (
          <button
            key={`${slide.heading}-${index}`}
            type="button"
            onClick={() => setCurrentIndex(index)}
            aria-label={`Go to slide ${index + 1}`}
            className={`h-2 rounded-full transition-all sm:h-2.5 ${
              index === currentIndex
                ? "w-8 bg-white sm:w-10"
                : "w-2 bg-white/40 hover:bg-white/65 sm:w-2.5"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
