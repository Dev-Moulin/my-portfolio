import React from 'react';
import { useTranslation } from 'react-i18next';
import HomeWallSkill from '../home/HomeWallSkill';
import LogoWall from '../home/LogoWall';

const Home: React.FC = () => {
  const { t } = useTranslation();

  return (
    <>
      <section className="min-h-screen flex items-center justify-center bg-[var(--background)] text-[var(--white)] relative" id="home">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-gradient">
              {t('home.title')}
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-[var(--sec)]">
              {t('home.subtitle')}
            </p>
            <p className="text-base md:text-lg mb-8 text-[var(--white-icon)] opacity-80">
              {t('home.description')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="#projects" 
                className="bg-[var(--sec)] text-[var(--background)] px-8 py-3 rounded-lg 
                         font-semibold transition-all duration-300 hover:scale-105 
                         hover:shadow-[0_0_20px_rgba(164,118,255,0.3)]"
              >
                {t('home.cta')}
              </a>
              <a 
                href="#contact" 
                className="border-2 border-[var(--sec)] text-[var(--sec)] px-8 py-3 
                         rounded-lg font-semibold transition-all duration-300 
                         hover:bg-[var(--sec)] hover:text-[var(--background)]"
              >
                {t('nav.contact')}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[var(--background)] relative" id="skills">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-[var(--white)]">
            {t('home.skills')}
          </h2>
          
          {/* Ajout du LogoWall ici */}
          <div className="mb-16">
            <LogoWall />
          </div>
          
          {/* Puis HomeWallSkill */}
          <HomeWallSkill />
        </div>
      </section>
    </>
  );
};

export default Home;