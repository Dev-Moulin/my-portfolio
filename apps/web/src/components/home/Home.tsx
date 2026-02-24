import React from 'react';
import { useTranslation } from 'react-i18next';
import HomeWallSkill from '../home/HomeWallSkill';
import LogoWall from '../home/LogoWall';

const Home: React.FC = () => {
  const { t } = useTranslation();

  return (
    <>
      <section className="min-h-screen flex items-center justify-center relative" id="home">
        {/* Title + subtitle rendered in 3D canvas via ScrollTextSystem */}
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