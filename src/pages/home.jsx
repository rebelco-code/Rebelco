import Navbar from "../components/navbar";
import Gallery from "../components/gallery";
import HomeBottomSection from "../components/home-bottom-section";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar showAnnouncement />
      <main>
        <Gallery />
        <HomeBottomSection />
      </main>
    </div>
  );
}
