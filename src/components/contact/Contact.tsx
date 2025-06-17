// src/components/contact/Contact.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import '../../styles/components/contact.css';
import GitHubIcon from '../icons/GitHubIcon';
import LinkedInIcon from '../icons/LinkedInIcon';
import TwitterIcon from '../icons/TwitterIcon';

const Contact = () => {
  const { t } = useTranslation();

  return (
    <section id="contact" className="contact-section">
      <div className="contact-container">
        <div className="contact-header">
          <h2 className="contact-title">{t('contact.title')}</h2>
          <p className="contact-subtitle">
            {t('contact.subtitle')}
          </p>
        </div>

        <div className="contact-content">
          <div className="contact-info">
            <div className="contact-item">
              <div className="contact-icon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z" />
                </svg>
              </div>
              <div>
                <h3>{t('contact.email')}</h3>
                <p>p.moulin.95@gmail.com</p>
              </div>
            </div>

            <div className="contact-item">
              <div className="contact-icon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              </div>
              <div>
                <h3>{t('contact.location')}</h3>
                <p>{t('contact.locationValue')}</p>
              </div>
            </div>

            <div className="contact-item">
              <div className="contact-icon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V8H19V19ZM19 6H5V5H19V6Z" />
                </svg>
              </div>
              <div>
                <h3>{t('contact.socialNetworks')}</h3>
                <div className="social-links">
                  <a 
                    href="https://github.com/Dev-Moulin" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="social-link"
                  >
                    <GitHubIcon size={24} />
                    <span>{t('common.github')}</span>
                  </a>
                  <a 
                    href="https://www.linkedin.com/in/paul-moulin-4b130232b" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="social-link"
                  >
                    <LinkedInIcon size={24} />
                    <span>{t('common.linkedin')}</span>
                  </a>
                  <a 
                    href="https://x.com/Dev_FullPoulpe" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="social-link"
                  >
                    <TwitterIcon size={24} />
                    <span>{t('common.twitter')}</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;