import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { HexColorPicker } from 'react-colorful';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPalette,
  faSun,
  faMoon,
  faDesktop,
  faEye,
  faRotateLeft,
} from '@fortawesome/free-solid-svg-icons';
import { useTheme } from '../../hooks/useTheme';

interface ColorOption {
  name: string;
  value: string;
  cssVar: string;
}

const ThemeCustomizer: React.FC = () => {
  const { theme, toggleTheme, setTheme } = useTheme();
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
  const [colors, setColors] = useState({
    primary: '#4285F4',
    secondary: '#34A853',
    accent: '#FBBC05',
    success: '#34A853',
    warning: '#FBBC05',
    danger: '#EA4335',
  });

  const colorOptions: ColorOption[] = [
    { name: 'Primary', value: colors.primary, cssVar: '--primary' },
    { name: 'Secondary', value: colors.secondary, cssVar: '--secondary' },
    { name: 'Accent', value: colors.accent, cssVar: '--accent' },
    { name: 'Success', value: colors.success, cssVar: '--success' },
    { name: 'Warning', value: colors.warning, cssVar: '--warning' },
    { name: 'Danger', value: colors.danger, cssVar: '--danger' },
  ];

  const presetThemes = [
    {
      name: 'Default',
      colors: {
        primary: '#4285F4',
        secondary: '#34A853',
        accent: '#FBBC05',
      },
    },
    {
      name: 'Purple',
      colors: {
        primary: '#7C3AED',
        secondary: '#A855F7',
        accent: '#C084FC',
      },
    },
    {
      name: 'Ocean',
      colors: {
        primary: '#0EA5E9',
        secondary: '#06B6D4',
        accent: '#67E8F9',
      },
    },
    {
      name: 'Forest',
      colors: {
        primary: '#059669',
        secondary: '#10B981',
        accent: '#6EE7B7',
      },
    },
  ];

  const handleColorChange = (colorKey: string, newColor: string) => {
    const updatedColors = { ...colors, [colorKey]: newColor };
    setColors(updatedColors);
    
    // Apply color to CSS custom property
    document.documentElement.style.setProperty(
      colorOptions.find(c => c.name.toLowerCase() === colorKey)?.cssVar || '',
      newColor
    );
  };

  const applyPreset = (preset: any) => {
    setColors({ ...colors, ...preset.colors });
    
    // Apply all preset colors to CSS
    Object.entries(preset.colors).forEach(([key, value]) => {
      const cssVar = colorOptions.find(c => c.name.toLowerCase() === key)?.cssVar;
      if (cssVar) {
        document.documentElement.style.setProperty(cssVar, value as string);
      }
    });
  };

  const resetToDefault = () => {
    const defaultColors = {
      primary: '#4285F4',
      secondary: '#34A853',
      accent: '#FBBC05',
      success: '#34A853',
      warning: '#FBBC05',
      danger: '#EA4335',
    };
    
    setColors(defaultColors);
    
    // Reset CSS custom properties
    Object.entries(defaultColors).forEach(([key, value]) => {
      const cssVar = colorOptions.find(c => c.name.toLowerCase() === key)?.cssVar;
      if (cssVar) {
        document.documentElement.style.setProperty(cssVar, value);
      }
    });
  };

  return (
    <motion.div
      className="dashboard-card theme-customizer"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <div className="dashboard-card__header">
        <h3 className="dashboard-card__header__title">
          <FontAwesomeIcon icon={faPalette} className="me-2" />
          Theme Customizer
        </h3>
      </div>
      
      <div className="theme-customizer__content">
        {/* Theme Mode Selector */}
        <div className="theme-section">
          <h4 className="theme-section__title">Theme Mode</h4>
          <div className="theme-mode-selector">
            <motion.button
              className={`theme-mode-option ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme('light')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FontAwesomeIcon icon={faSun} />
              <span>Light</span>
            </motion.button>
            
            <motion.button
              className={`theme-mode-option ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme('dark')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FontAwesomeIcon icon={faMoon} />
              <span>Dark</span>
            </motion.button>
            
            <motion.button
              className="theme-mode-option"
              onClick={toggleTheme}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Toggle Theme"
            >
              <FontAwesomeIcon icon={faDesktop} />
              <span>Auto</span>
            </motion.button>
          </div>
        </div>

        {/* Color Customization */}
        <div className="theme-section">
          <h4 className="theme-section__title">Colors</h4>
          <div className="color-options">
            {colorOptions.map((colorOption) => (
              <div key={colorOption.name} className="color-option">
                <label className="color-option__label">
                  {colorOption.name}
                </label>
                <motion.button
                  className="color-option__swatch"
                  style={{ backgroundColor: colorOption.value }}
                  onClick={() => setActiveColorPicker(
                    activeColorPicker === colorOption.name ? null : colorOption.name
                  )}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                />
                
                {activeColorPicker === colorOption.name && (
                  <motion.div
                    className="color-picker-popup"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <HexColorPicker
                      color={colorOption.value}
                      onChange={(color) => handleColorChange(colorOption.name.toLowerCase(), color)}
                    />
                    <motion.button
                      className="color-picker-close"
                      onClick={() => setActiveColorPicker(null)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      ×
                    </motion.button>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Preset Themes */}
        <div className="theme-section">
          <h4 className="theme-section__title">Preset Themes</h4>
          <div className="preset-themes">
            {presetThemes.map((preset) => (
              <motion.button
                key={preset.name}
                className="preset-theme"
                onClick={() => applyPreset(preset)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="preset-theme__colors">
                  {Object.values(preset.colors).map((color, index) => (
                    <span
                      key={index}
                      className="preset-theme__color"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <span className="preset-theme__name">{preset.name}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="theme-section">
          <h4 className="theme-section__title">Preview</h4>
          <div className="theme-preview">
            <div className="theme-preview__card">
              <div className="theme-preview__header" style={{ backgroundColor: colors.primary }}>
                <FontAwesomeIcon icon={faEye} />
                <span>Preview Card</span>
              </div>
              <div className="theme-preview__content">
                <p>This is how your theme will look.</p>
                <div className="theme-preview__buttons">
                  <button 
                    className="btn btn-sm"
                    style={{ backgroundColor: colors.secondary }}
                  >
                    Secondary
                  </button>
                  <button 
                    className="btn btn-sm"
                    style={{ backgroundColor: colors.accent }}
                  >
                    Accent
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reset Button */}
        <div className="theme-section">
          <motion.button
            className="btn btn-outline-danger w-100"
            onClick={resetToDefault}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <FontAwesomeIcon icon={faRotateLeft} className="me-2" />
            Reset to Default
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default ThemeCustomizer;