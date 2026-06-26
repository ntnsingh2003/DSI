import { createContext, useContext, useState } from 'react';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [uploadedData, setUploadedDataState] = useState(() => {
    try {
      const saved = localStorage.getItem('dsi_uploaded_data');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setUploadedData = (data) => {
    setUploadedDataState(data);
    try {
      if (data) {
        // Safe serialization: Truncate raw row data to prevent localStorage QuotaExceededError
        const serialized = {
          ...data,
          rows: data.rows ? data.rows.slice(0, 200) : [],
        };
        localStorage.setItem('dsi_uploaded_data', JSON.stringify(serialized));
      } else {
        localStorage.removeItem('dsi_uploaded_data');
      }
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  };

  return (
    <DataContext.Provider value={{ uploadedData, setUploadedData }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
