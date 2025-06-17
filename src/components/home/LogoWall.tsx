// src/components/home/LogoWall.tsx
import React from 'react';
import '../../styles/components/logoWall.css';

const LogoWall: React.FC = () => {
  const technologies = [

    "vue", 
    "react",
    "typeScript",
    "tailwindcss",
    "rails",
    "nodejs",
    "HTML5",
    "CSS3",
    "javaScript",
    "git",
    "ruby",
    "mysql",
    "bash",
    "postgresql",
    "threejs",
    "blender",
    "github",
    "python",
    "graphql",
  ];

  return (
    <div className="logo-wall-container">
      <div className="logo-wall-gradient-left"></div>
      <div className="logo-wall-gradient-right"></div>

      <div className="logo-wall-scroll">
        {[...technologies, ...technologies, ...technologies].map((tech, index) => (
          <div key={index} className="logo-wall-item">
            <img
              src={`/svg/${tech}.svg`}
              alt={tech}
              className="logo-wall-icon"
              width="30"
              height="30"
              loading="lazy"
            />
            <span className="logo-wall-label">
              {tech.charAt(0).toUpperCase() + tech.slice(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogoWall;