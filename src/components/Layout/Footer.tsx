// src/components/layout/Footer.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import LetterGlitch from '../animations/LetterGlitch';
import '../../styles/components/footer.css';
import GitHubIcon from '../icons/GitHubIcon';
import LinkedInIcon from '../icons/LinkedInIcon';
import TwitterIcon from '../icons/TwitterIcon';

const Footer = () => {
  const { t } = useTranslation();

  const socialLinks = [
    {
      href: "https://github.com/Dev-Moulin",
      icon: <GitHubIcon size={20} />,
      label: t('common.github')
    },
    {
      href: "https://www.linkedin.com/in/paul-moulin-4b130232b",
      icon: <LinkedInIcon size={20} />,
      label: t('common.linkedin')
    },
    {
      href: "https://x.com/Dev_FullPoulpe",
      icon: <TwitterIcon size={20} />,
      label: t('common.twitter')
    }
  ];

  return (
    <footer className="footer-container">
      {/* Background LetterGlitch */}
      <div className="footer-background">
        <LetterGlitch
          text={t('footer.backgroundText')}
          isBackground={true}
        />
      </div>

      <div className="footer-content">
        <div className="footer-main">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="footer-info">
                <h3 className="footer-title">{t('footer.title')}</h3>
                <p className="footer-subtitle">{t('footer.subtitle')}</p>
                <p className="footer-description">
                  {t('footer.description')}
                </p>
              </div>

              <div className="footer-links">
                <h4 className="footer-section-title">{t('footer.navigation')}</h4>
                <ul className="footer-nav">
                  <li><a href="#home">{t('nav.home')}</a></li>
                  <li><a href="#projects">{t('nav.projects')}</a></li>
                  <li><a href="#about">{t('nav.about')}</a></li>
                  <li><a href="#skills">{t('home.skills')}</a></li>
                  <li><a href="#contact">{t('nav.contact')}</a></li>
                </ul>
              </div>

              <div className="footer-social">
                <h4 className="footer-section-title">{t('footer.followMe')}</h4>
                <div className="social-links">
                  {socialLinks.map((link, index) => (
                    <a
                    key={index}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="social-link"
                    title={link.label}
                  >
                    {link.icon}
                  </a>
                  ))}
                </div>
              </div>
            </div>

            <div className="footer-bottom">
              <p>{t('footer.copyright')}</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;