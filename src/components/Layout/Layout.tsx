import React from 'react';
import NavArc from './NavArc';
import Footer from '../Layout/Footer';
import '../../styles/global.css';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="bg-[--background] md:px-48 lg:px-20 px-9">
      <NavArc />
      <main>{children}</main>
      <Footer />
    </div>
  );
};

export default Layout;