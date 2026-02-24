import { AccentColorProvider } from './components/ThemeProvider';
import { OvermindOverlay } from '@portfolio/overmind-3d';
import Home from './components/home/Home';
import Projects from './components/projects/Projects';
import Contact from './components/contact/Contact';
import Layout from './components/Layout/Layout';

function App() {
  return (
    <AccentColorProvider>
      <div className="relative min-h-screen">
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
