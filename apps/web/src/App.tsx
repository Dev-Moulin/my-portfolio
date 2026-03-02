import { useEffect } from 'react';
import { AccentColorProvider } from './components/ThemeProvider';
import { OvermindOverlay } from '@portfolio/overmind-3d';
import Home from './components/home/Home';
import Projects from './components/projects/Projects';
import Contact from './components/contact/Contact';
import Layout from './components/Layout/Layout';

/** Emits raw scroll ratio (0→1) — dwell remap is done in ScrollBridge inside overmind-3d */
function ScrollProgressEmitter() {
  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const raw = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;
      window.dispatchEvent(
        new CustomEvent('overmind:scroll-progress', { detail: raw })
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
