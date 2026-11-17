import { createContext, useContext } from 'react';
import { LANDING_SECTIONS } from '../../shared/landing-sections.js';

const PreviewEditingContext = createContext(null);

// Only the configurator supplies this callback; standalone and public previews
// retain their normal links, accordions and media controls.
export function PreviewEditing({ onSelectSection, children }) {
  return <PreviewEditingContext.Provider value={onSelectSection}>
    {children}
  </PreviewEditingContext.Provider>;
}

export function usePreviewSection() {
  const onSelectSection = useContext(PreviewEditingContext);
  function select(event) {
    const section = event.target.closest('[data-editor-section]');
    if (!section) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectSection(section.dataset.editorSection);
  }
  return id => onSelectSection ? {
    'data-editor-section': id,
    tabIndex: 0,
    role: 'button',
    title: `Editar: ${LANDING_SECTIONS[id][1]}`,
    'aria-label': `Editar: ${LANDING_SECTIONS[id][1]}`,
    'aria-labelledby': undefined,
    onClickCapture: select,
    onKeyDownCapture: event => {
      if (event.key === 'Enter' || event.key === ' ') select(event);
    },
  } : {};
}
