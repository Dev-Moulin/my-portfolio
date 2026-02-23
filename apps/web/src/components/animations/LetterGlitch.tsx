import React, { useRef, useEffect, useCallback } from "react";

interface LetterGlitchProps {
  text: string;
  glitchColors?: string[];
  glitchSpeed?: number;
  className?: string;
  isBackground?: boolean; // Nouvelle prop pour le mode background
}

const LetterGlitch: React.FC<LetterGlitchProps> = ({
  text,
  glitchColors = ["var(--sec)", "#A476FF", "#241a38"],
  glitchSpeed = 33,
  className = "",
  isBackground = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const lettersRef = useRef<{
    char: string;
    color: string;
    targetColor: string;
    colorProgress: number;
  }[]>([]);

  const getRandomChar = useCallback(() => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$&*()";
    return chars[Math.floor(Math.random() * chars.length)];
  }, []);

  const getRandomColor = useCallback(() => {
    return glitchColors[Math.floor(Math.random() * glitchColors.length)];
  }, [glitchColors]);

  const initializeLetters = useCallback(() => {
    lettersRef.current = text.split('').map(char => ({
      char,
      color: getRandomColor(),
      targetColor: getRandomColor(),
      colorProgress: 1,
    }));
  }, [text, getRandomColor]);

  const renderLetters = useCallback(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = lettersRef.current
      .map(
        (letter, index) =>
          `<span class="glitch-letter ${isBackground ? 'opacity-[0.03]' : ''}" 
           style="color: ${letter.color}; transition-delay: ${index * 50}ms;">
           ${letter.char}
           </span>`
      )
      .join("");
  }, [isBackground]);

  const updateLetters = useCallback(() => {
    if (!containerRef.current) return;
    
    const letters = lettersRef.current;
    const updateCount = Math.max(1, Math.floor(letters.length * 0.05));

    for (let i = 0; i < updateCount; i++) {
      const index = Math.floor(Math.random() * letters.length);
      letters[index].char = getRandomChar();
      setTimeout(() => {
        letters[index].char = text[index];
      }, glitchSpeed);
    }

    renderLetters();
  }, [text, glitchSpeed, getRandomChar, renderLetters]);

  const animate = useCallback(() => {
    updateLetters();
    animationRef.current = requestAnimationFrame(animate);
  }, [updateLetters]);

  useEffect(() => {
    initializeLetters();
    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [text, initializeLetters, animate]);

  return (
    <div 
      ref={containerRef} 
      className={`${isBackground ? 'absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none select-none' : ''} ${className}`}
      aria-label={text}
    />
  );
};

export default LetterGlitch;