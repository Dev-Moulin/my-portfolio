import { ThemeProvider } from './components/ThemeProvider';
import Home from './components/home/Home';
import Projects from './components/projects/Projects';
import Contact from './components/contact/Contact';
import Layout from './components/Layout/Layout';

function App() {
  return (
    <ThemeProvider>
      <div className="relative min-h-screen bg-background">
        <Layout>
          <main className="container relative mx-auto px-4">
            <Home />
            <Projects />
            <Contact />
          </main>
        </Layout>
      </div>
    </ThemeProvider>
  );
}

export default App;
