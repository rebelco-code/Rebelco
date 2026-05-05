import Navbar from "../components/navbar";
import Gallery from "../components/gallery";
import HomeBottomSection from "../components/home-bottom-section";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#1f2023]">
      <Navbar className="absolute inset-x-0 top-0 z-50 bg-transparent" />
      <main>
        <Gallery />
        <HomeBottomSection />
      </main>
    </div>
  );
}
