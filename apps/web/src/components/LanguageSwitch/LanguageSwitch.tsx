import React from 'react';
import { useTranslation } from 'react-i18next';
import '../../styles/components/languageSwitch.css';

const LanguageSwitch: React.FC = () => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'fr' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="language-switch"
      aria-label={`Switch to ${i18n.language === 'en' ? 'French' : 'English'}`}
    >
      <div className="language-switch-content">
        <span className={`lang ${i18n.language === 'en' ? 'active' : ''}`}>EN</span>
        <span className="separator">|</span>
        <span className={`lang ${i18n.language === 'fr' ? 'active' : ''}`}>FR</span>
      </div>
    </button>
  );
};

export default LanguageSwitch;