import React from 'react';
import NavArc from './NavArc';

/**
 * Layout — site 3D : la navigation passe entièrement par la NavArc (montée en portal sur
 * document.body) + la gauge molette. Les anciennes pages DOM (Home/Projects/Contact) et le
 * Footer ont été retirés (cf. plan NavArc 3D) — la scène 3D plein écran fait office de contenu.
 */
const Layout: React.FC = () => <NavArc />;

export default Layout;
