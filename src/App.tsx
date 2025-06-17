// src/App.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ThemeProvider } from './components/ThemeProvider';
import Home from './components/home/Home';
import Projects from './components/projects/Projects';
import Contact from './components/contact/Contact';
import NavArc from './components/Layout/NavArc';
import Footer from './components/Layout/Footer';
import './styles/global.css';

// Import i18n OBLIGATOIRE
import './i18n';

function App() {
  const { t } = useTranslation();

  return (
    <ThemeProvider defaultTheme="dark" storageKey="portfolio-theme">
      <div className="min-h-screen bg-[var(--background)] text-[var(--white)]">
        <NavArc />
        <main className="flex flex-col">
          <Home />
          <Projects />
          <section id="about" className="min-h-screen flex items-center justify-center">
            <div className="container mx-auto px-4">
              <div className="text-center">
                <h2 className="text-4xl font-bold mb-6 text-[var(--white)]">{t('about.title')}</h2>
                <div className="max-w-4xl mx-auto">
                  <p className="text-lg text-[var(--white-icon)] mb-8 leading-relaxed">
                    {t('about.description')}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
                    <div className="text-center">
                      <h3 className="text-2xl font-bold text-[var(--sec)] mb-4">{t('about.stats.age')}</h3>
                      <p className="text-[var(--white-icon)]">{t('about.stats.location')}</p>
                    </div>
                    <div className="text-center">
                      <h3 className="text-2xl font-bold text-[var(--sec)] mb-4">{t('about.stats.training')}</h3>
                      <p className="text-[var(--white-icon)]">{t('about.stats.trainingDesc')}</p>
                    </div>
                    <div className="text-center">
                      <h3 className="text-2xl font-bold text-[var(--sec)] mb-4">{t('about.stats.passion')}</h3>
                      <p className="text-[var(--white-icon)]">{t('about.stats.passionDesc')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <Contact />
        </main>
        <Footer />
      </div>
    </ThemeProvider>
  );
}

export default App;