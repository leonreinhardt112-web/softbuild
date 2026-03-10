import React, { createContext, useContext, useState } from 'react';

const UnsavedChangesContext = createContext(null);

export function UnsavedChangesProvider({ children }) {
  const [unsavedState, setUnsavedState] = useState({
    hasChanges: false,
    onConfirm: null,
  });

  return (
    <UnsavedChangesContext.Provider value={{ unsavedState, setUnsavedState }}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error('useUnsavedChanges must be used within UnsavedChangesProvider');
  }
  return context;
}