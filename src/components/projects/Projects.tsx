import React from 'react';
import { useTranslation } from 'react-i18next';
import '../../styles/components/projects.css';

interface Project {
  title: string;
  description: string;
  technologies: string[];
  imageUrl: string;
  videoUrl?: string;
  githubUrl?: string;
  liveUrl?: string;
  demoUrl?: string;
  documentation?: string;
  trelloUrl?: string;
  figmaUrl?: string;
  miroUrl?: string;
  status: 'completed' | 'in-progress' | 'hackathon';
  duration?: string;
  team?: boolean;
  teamMembers?: string[];
  problemSolved?: string;
  hackathonDetails?: {
    name: string;
    url: string;
    projectUrl?: string;
  };
}

const Projects: React.FC = () => {
  const { t } = useTranslation();

  const projects: Project[] = [
    {
      title: t('projects.intuition.title'),
      description: t('projects.intuition.description'),
      problemSolved: t('projects.intuition.problemSolved'),
      technologies: ["React", "TypeScript", "Chrome Extension API", "Web3", "Plasmo", "Intuition Protocol", "GraphQL", "Tailwind CSS"],
      imageUrl: "./projects/accueilCoinTribe.png",
      videoUrl: "https://www.youtube.com/watch?v=YJwcXQ3oAWY",
      githubUrl: "https://github.com/THP-Lab/intuition-chrome-extension",
      demoUrl: "https://artizen.fund/index/p/intuition-chrome-extension?scroll=no&season=6",
      status: "in-progress",
      duration: "3 mois (stage THP Lab)",
      team: true,
      teamMembers: ["James Barthée", "Alexe Marichal", "Paul Moulin", "Zaineb Padilla"],
      hackathonDetails: {
        name: t('projects.hackathons.baseBatch.name'),
        url: "https://base-batch-europe.devfolio.co/",
        projectUrl: "https://devfolio.co/projects/intuition-chromeextention-afea"
      }
    },
    {
      title: t('projects.coinTribe.title'),
      description: t('projects.coinTribe.description'),
      technologies: ["Ruby 3.2.2", "Rails 8", "PostgreSQL", "JavaScript", "CSS", "Devise", "Stripe", "Mailjet", "Heroku"],
      imageUrl: "/projects/accueilCoinTribe.png",
      githubUrl: "https://github.com/DevFullstackCo/CoinTribe",
      liveUrl: "https://cryptovotingproject-cc7f6a61a180.herokuapp.com/",
      documentation: "https://docs.google.com/document/d/1q29IyqbOnZ7NYARIGE5facmB-I31Vpd8y4DoW87DG8g/edit?tab=t.0",
      trelloUrl: "https://trello.com/b/QAaB0KZ0/crypto",
      figmaUrl: "https://www.figma.com/design/C45RQ27ofXu7LBsclNEzXi/Untitled?node-id=580-640",
      miroUrl: "https://miro.com/app/board/uXjVL9eGfJ0=/",
      status: "completed",
      duration: "1 semaine",
      teamMembers: ["Florian Tribout", "Alexe Marichal", "Paul Moulin", "James Barthée", "Caroline Olivier"]
    }
  ];

  const hackathons = [
    {
      name: t('projects.hackathons.baseBatch.name'),
      project: t('projects.hackathons.baseBatch.project'),
      url: "https://base-batch-europe.devfolio.co/",
      projectUrl: "https://devfolio.co/projects/intuition-chromeextention-afea",
      status: t('projects.hackathons.baseBatch.status'),
      description: t('projects.hackathons.baseBatch.description')
    },
    {
      name: t('projects.hackathons.artizen.name'),
      project: t('projects.hackathons.artizen.project'),
      url: "https://artizen.fund/index/p/intuition-chrome-extension?scroll=no&season=6",
      status: t('projects.hackathons.artizen.status')
    },
    {
      name: t('projects.hackathons.ethCannes.name'),
      project: t('projects.hackathons.ethCannes.project'),
      url: "https://ethglobal.com/events/cannes",
      status: t('projects.hackathons.ethCannes.status')
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="text-xs px-3 py-1 rounded-full bg-green-500/10 text-green-400">{t('projects.completed')}</span>;
      case 'in-progress':
        return <span className="text-xs px-3 py-1 rounded-full bg-blue-500/10 text-blue-400">{t('projects.inProgress')}</span>;
      case 'hackathon':
        return <span className="text-xs px-3 py-1 rounded-full bg-purple-500/10 text-purple-400">{t('projects.hackathon')}</span>;
      default:
        return null;
    }
  };

  return (
    <section id="projects" className="py-20 bg-[var(--background)]">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-[var(--white)] text-gradient">
          {t('projects.title')}
        </h2>

        {/* Projets principaux */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {projects.map((project, index) => (
            <div key={index} className="bg-[var(--background)] border border-[#ffffff10] rounded-xl overflow-hidden transition-all duration-300 hover:transform hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(164,118,255,0.1)]">
              <div className="relative aspect-video">
                {project.videoUrl ? (
                  <div className="w-full h-full">
                    <iframe
                      src={project.videoUrl.replace('watch?v=', 'embed/')}
                      title={project.title}
                      className="w-full h-full"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                ) : (
                  <img 
                    src={project.imageUrl} 
                    alt={project.title} 
                    className="w-full h-full object-cover"
                    loading="lazy" 
                  />
                )}
                <div className="absolute top-4 left-4">
                  {getStatusBadge(project.status)}
                </div>
                <div className="absolute top-4 right-4 flex gap-2 flex-wrap">
                  {project.demoUrl && (
                    <a 
                      href={project.demoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-[var(--background)]/80 p-2 rounded-full backdrop-blur-sm text-[var(--white-icon)] hover:text-[var(--white)] transition-colors"
                      title={t('projects.seeOnArtizen')}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1zM10 6a2 2 0 0 1 4 0v1h-4V6zm8 13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9h2v1a1 1 0 0 0 2 0V9h4v1a1 1 0 0 0 2 0V9h2v10z"/>
                      </svg>
                    </a>
                  )}
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-semibold text-[var(--white)]">
                    {project.title}
                  </h3>
                  {/* GitHub icon au niveau du titre */}
                  {project.githubUrl && (
                    <a 
                      href={project.githubUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-[var(--background)] p-2 rounded-full border border-[var(--white-icon)]/20 text-[var(--white-icon)] hover:text-[var(--white)] hover:border-[var(--sec)]/50 transition-colors"
                      title={t('projects.sourceCode')}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.138 20.17 22 16.42 22 12c0-5.523-4.477-10-10-10z" />
                      </svg>
                    </a>
                  )}
                </div>

                {/* Hackathon details */}
                {project.hackathonDetails && (
                  <div className="mb-3 p-3 rounded-lg bg-[var(--sec)]/10 border border-[var(--sec)]/20">
                    <p className="text-sm text-[var(--sec)] font-medium mb-1">
                      🏆 {t('projects.hackathon')} : 
                      <a 
                        href={project.hackathonDetails.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 hover:text-[var(--white)] transition-colors"
                      >
                        {project.hackathonDetails.name}
                      </a>
                    </p>
                    {project.hackathonDetails.projectUrl && (
                      <a 
                        href={project.hackathonDetails.projectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--white-icon)] hover:text-[var(--sec)] transition-colors"
                      >
                        🔗 {t('projects.seeProject')} Devfolio
                      </a>
                    )}
                  </div>
                )}

                {project.duration && (
                  <p className="text-sm text-[var(--white-icon)] mb-2 opacity-70">
                    {t('projects.duration')} : {project.duration}
                  </p>
                )}
                <p className="text-[var(--white-icon)] mb-4 text-sm leading-relaxed">
                  {project.description}
                </p>

                {/* Problem solved section for Intuition */}
                {project.problemSolved && (
                  <div className="mb-4 p-3 rounded-lg bg-[var(--background)] border border-[var(--white-icon)]/10">
                    <h4 className="text-sm font-semibold text-[var(--white)] mb-2">{t('projects.problemSolved')} :</h4>
                    <p className="text-xs text-[var(--white-icon)] leading-relaxed">
                      {project.problemSolved}
                    </p>
                  </div>
                )}
                
                {/* Team members */}
                {project.teamMembers && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-[var(--white)] mb-2">{t('projects.team')} :</h4>
                    <div className="flex flex-wrap gap-1">
                      {project.teamMembers.map((member, memberIndex) => (
                        <span 
                          key={memberIndex}
                          className="text-xs px-2 py-1 rounded bg-[var(--background)] border border-[var(--white-icon)]/20 text-[var(--white-icon)]"
                        >
                          {member}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Technologies */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-[var(--white)] mb-2">{t('projects.technologies')} :</h4>
                  <div className="flex flex-wrap gap-2">
                    {project.technologies.map((tech, techIndex) => (
                      <span 
                        key={techIndex} 
                        className="text-xs px-3 py-1 rounded-full bg-[var(--sec)]/10 text-[var(--sec)]"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Additional links */}
                {(project.trelloUrl || project.figmaUrl || project.miroUrl || project.documentation || project.liveUrl || project.videoUrl) && (
                  <div className="border-t border-[var(--white-icon)]/10 pt-4">
                    <h4 className="text-sm font-semibold text-[var(--white)] mb-2">{t('projects.additionalLinks')} :</h4>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {project.liveUrl && (
                        <a 
                          href={project.liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[var(--sec)] hover:text-[var(--white)] transition-colors"
                        >
                          🌐 {t('projects.liveDemo')}
                        </a>
                      )}
                      {project.videoUrl && (
                        <a 
                          href={project.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[var(--sec)] hover:text-[var(--white)] transition-colors"
                        >
                          🎬 {t('projects.videoDemo')}
                        </a>
                      )}
                      {project.trelloUrl && (
                        <a 
                          href={project.trelloUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[var(--sec)] hover:text-[var(--white)] transition-colors"
                        >
                          📋 {t('projects.trello')}
                        </a>
                      )}
                      {project.figmaUrl && (
                        <a 
                          href={project.figmaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[var(--sec)] hover:text-[var(--white)] transition-colors"
                        >
                          🎨 {t('projects.figma')}
                        </a>
                      )}
                      {project.miroUrl && (
                        <a 
                          href={project.miroUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[var(--sec)] hover:text-[var(--white)] transition-colors"
                        >
                          🗂️ {t('projects.miro')}
                        </a>
                      )}
                      {project.documentation && (
                        <a 
                          href={project.documentation}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[var(--sec)] hover:text-[var(--white)] transition-colors"
                        >
                          📄 {t('projects.documentation')}
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Section Hackathons */}
        <div className="mt-16">
          <h3 className="text-2xl md:text-3xl font-bold text-center mb-8 text-[var(--white)]">
            {t('projects.hackathonsTitle')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hackathons.map((hackathon, index) => (
              <div key={index} className="bg-[var(--background)] border border-[#ffffff10] rounded-lg p-6 transition-all duration-300 hover:border-[var(--sec)]/30">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-[var(--white)]">
                    {hackathon.name}
                  </h4>
                  <span className="text-xs px-3 py-1 rounded-full bg-[var(--sec)]/10 text-[var(--sec)]">
                    {hackathon.status}
                  </span>
                </div>
                <p className="text-[var(--white-icon)] mb-3">
                  Projet : {hackathon.project}
                </p>
                {hackathon.description && (
                  <p className="text-xs text-[var(--white-icon)] mb-4 opacity-80 leading-relaxed">
                    {hackathon.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <a 
                    href={hackathon.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-[var(--sec)] hover:text-[var(--white)] transition-colors text-sm"
                  >
                    {t('projects.seeHackathon')}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-1">
                      <path d="M16.01 11H4v2h12.01v3L20 12l-3.99-4z"/>
                    </svg>
                  </a>
                  {hackathon.projectUrl && (
                    <a 
                      href={hackathon.projectUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-[var(--sec)] hover:text-[var(--white)] transition-colors text-sm"
                    >
                      {t('projects.seeProject')}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-1">
                        <path d="M16.01 11H4v2h12.01v3L20 12l-3.99-4z"/>
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section Formation & Apprentissage */}
        <div className="mt-16 text-center">
          <h3 className="text-2xl md:text-3xl font-bold mb-8 text-[var(--white)]">
            {t('projects.trainingTitle')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[var(--background)] border border-[#ffffff10] rounded-lg p-6">
              <h4 className="text-lg font-semibold text-[var(--white)] mb-2">
                {t('projects.training.thp.title')}
              </h4>
              <p className="text-[var(--white-icon)] text-sm mb-2">
                {t('projects.training.thp.subtitle')}
              </p>
              <p className="text-[var(--white-icon)] text-sm">
                {t('projects.training.thp.duration')}
              </p>
            </div>
            <div className="bg-[var(--background)] border border-[#ffffff10] rounded-lg p-6">
              <h4 className="text-lg font-semibold text-[var(--white)] mb-2">
                {t('projects.training.threejs.title')}
              </h4>
              <p className="text-[var(--white-icon)] text-sm mb-2">
                {t('projects.training.threejs.subtitle')}
              </p>
              <p className="text-[var(--white-icon)] text-sm">
                {t('projects.training.threejs.duration')}
              </p>
            </div>
            <div className="bg-[var(--background)] border border-[#ffffff10] rounded-lg p-6">
              <h4 className="text-lg font-semibold text-[var(--white)] mb-2">
                {t('projects.training.blender.title')}
              </h4>
              <p className="text-[var(--white-icon)] text-sm mb-2">
                {t('projects.training.blender.subtitle')}
              </p>
              <p className="text-[var(--white-icon)] text-sm">
                {t('projects.training.blender.duration')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Projects;