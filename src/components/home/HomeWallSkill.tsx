// src/components/home/HomeWallSkill.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import '../../styles/components/homeWallSkill.css';

interface SkillCategory {
  categoryKey: string;
  icon: React.ReactNode;
  technologies: {
    name: string;
    svgPath: string;
  }[];
}

const HomeWallSkill: React.FC = () => {
  const { t } = useTranslation();
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const skillCategories: SkillCategory[] = [
    {
      categoryKey: "programming",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-6 h-6 text-[var(--sec)] opacity-70"
        >
          <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
        </svg>
      ),
      technologies: [
        { name: "JavaScript", svgPath: "./svg/javaScript.svg" },
        { name: "TypeScript", svgPath: "/svg/typeScript.svg" },
        { name: "Ruby", svgPath: "/svg/ruby.svg" },
        { name: "Python", svgPath: "/svg/python.svg" },
        { name: "HTML5", svgPath: "/svg/HTML5.svg" },
        { name: "CSS3", svgPath: "/svg/CSS3.svg" }
      ]
    },
    {
      categoryKey: "frontend",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-6 h-6 text-[var(--sec)] opacity-70"
        >
          <path d="M21 3C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H21ZM20 11H4V19H20V11ZM20 5H4V9H20V5Z" />
        </svg>
      ),
      technologies: [
        { name: "React", svgPath: "/svg/react.svg" },
        { name: "Vue", svgPath: "/svg/vue.svg" },
        { name: "Tailwind CSS", svgPath: "/svg/tailwindcss.svg" }
      ]
    },
    {
      categoryKey: "backend",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-6 h-6 text-[var(--sec)] opacity-70"
        >
          <path d="M12 1L21.5 6.5V17.5L12 23L2.5 17.5V6.5L12 1ZM12 3.311L5.5 7.21875V16.7812L12 20.689L18.5 16.7812V7.21875L12 3.311Z"/>
        </svg>
      ),
      technologies: [
        { name: "Ruby on Rails", svgPath: "/svg/rails.svg" },
        { name: "Node.js", svgPath: "/svg/nodejs.svg" },
        { name: "PostgreSQL", svgPath: "/svg/postgresql.svg" },
        { name: "MySQL", svgPath: "/svg/mysql.svg" }
      ]
    },
    {
      categoryKey: "tools",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-6 h-6 text-[var(--sec)] opacity-70"
        >
          <path d="M22.46 6C21.69 6 21.04 6.52 20.84 7.25L18.37 15.29C18.24 15.74 17.79 16 17.29 16H7.14L6.5 14H17.29C17.79 14 18.24 13.74 18.37 13.29L20.84 5.25C21.04 4.52 21.69 4 22.46 4C23.31 4 24 4.69 24 5.54S23.31 7.08 22.46 7.08V6Z"/>
        </svg>
      ),
      technologies: [
        { name: "Git", svgPath: "/svg/git.svg" },
        { name: "GitHub", svgPath: "/svg/github.svg" },
        { name: "Bash", svgPath: "/svg/bash.svg" }
      ]
    },
    {
      categoryKey: "3d",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-6 h-6 text-[var(--sec)] opacity-70"
        >
          <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z"/>
        </svg>
      ),
      technologies: [
        { name: "Three.js", svgPath: "/svg/threejs.svg" },
        { name: "Blender", svgPath: "/svg/blender.svg" }
      ]
    }
  ];

  const toggleCategory = (categoryKey: string) => {
    setOpenCategory(openCategory === categoryKey ? null : categoryKey);
  };

  return (
    <div className="home-wall-skill-container">
      <motion.h3 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="home-wall-skill-title"
      >
        {t('skills.title')}
      </motion.h3>

      <motion.div 
        className="home-wall-skill-list"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {skillCategories.map((skillCategory, index) => (
          <motion.div 
            key={skillCategory.categoryKey}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="home-wall-skill-item"
          >
            <button
              onClick={() => toggleCategory(skillCategory.categoryKey)}
              className={`home-wall-skill-button ${openCategory === skillCategory.categoryKey ? 'active' : ''}`}
            >
              <div className="home-wall-skill-header">
                {skillCategory.icon}
                <span className="home-wall-skill-category">{t(`skills.${skillCategory.categoryKey}`)}</span>
                <motion.svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="home-wall-skill-arrow"
                  animate={{ rotate: openCategory === skillCategory.categoryKey ? 180 : 0 }}
                >
                  <path d="M11.9999 13.1714L16.9497 8.22168L18.3639 9.63589L11.9999 15.9999L5.63599 9.63589L7.0502 8.22168L11.9999 13.1714Z" />
                </motion.svg>
              </div>

              <AnimatePresence>
                {openCategory === skillCategory.categoryKey && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="home-wall-skill-details"
                  >
                    <div className="home-wall-skill-technologies">
                      {skillCategory.technologies.map((tech, techIndex) => (
                        <motion.div
                          key={tech.name}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: techIndex * 0.1 }}
                          className="home-wall-skill-tech-item"
                        >
                          <img
                            src={tech.svgPath}
                            alt={tech.name}
                            className="home-wall-skill-tech-icon"
                            width="38"
                            height="38"
                            loading="lazy"
                          />
                          <span className="home-wall-skill-tech-label">
                            {tech.name}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};

export default HomeWallSkill;