import { useEffect } from 'react';
import { AccentColorProvider } from './components/ThemeProvider';
import { OvermindOverlay } from '@portfolio/overmind-3d';
import Home from './components/home/Home';
import Projects from './components/projects/Projects';
import Contact from './components/contact/Contact';
import Layout from './components/Layout/Layout';

// Scroll dwells: pause the progress at keyframes so the user can read before the scene transitions
const DWELLS = [
  { at: 0.300, duration: 0.10 },   // pause at title view
  { at: 0.685, duration: 0.10 },   // pause when card appears
];

function remapProgress(raw: number): number {
  const totalDwell = DWELLS.reduce((s, d) => s + d.duration, 0);
  const useful = 1.0 - totalDwell;
  if (useful <= 0) return 0;

  // Compute where each dwell starts/ends in raw-scroll space
  const breakpoints = DWELLS.map((d, i) => {
    const prevDwellSum = DWELLS.slice(0, i).reduce((s, dd) => s + dd.duration, 0);
    const rawStart = d.at * useful + prevDwellSum;
    return { at: d.at, rawStart, rawEnd: rawStart + d.duration };
  });

  // Walk through breakpoints to find how much dwell-raw has been consumed
  let dwellConsumed = 0;
  for (const bp of breakpoints) {
    if (raw <= bp.rawStart) break;
    if (raw >= bp.rawEnd) {
      dwellConsumed += bp.rawEnd - bp.rawStart;
    } else {
      // Currently inside this dwell — progress is frozen
      return bp.at;
    }
  }

  const usefulConsumed = raw - dwellConsumed;
  return Math.min(1, usefulConsumed / useful);
}

function ScrollProgressEmitter() {
  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const raw = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;
      const progress = remapProgress(raw);
      window.dispatchEvent(
        new CustomEvent('overmind:scroll-progress', { detail: progress })
      );
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  return null;
}

function App() {
  return (
    <AccentColorProvider>
      <div className="relative min-h-screen">
        <ScrollProgressEmitter />
        <OvermindOverlay basePath={import.meta.env.BASE_URL} showDevPanel={import.meta.env.DEV} />
        <Layout>
          <main className="container relative mx-auto px-4">
            <Home />
            <Projects />
            <Contact />
          </main>
        </Layout>
      </div>
    </AccentColorProvider>
  );
}

export default App;
