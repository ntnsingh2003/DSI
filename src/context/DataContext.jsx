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

  // Tracks live pipeline stage progress for dev debug visibility
  const [pipelineStages, setPipelineStages] = useState([]);

  const setUploadedData = (data) => {
    setUploadedDataState(data);
    try {
      if (data) {
        // Truncate rows to keep localStorage payload within quota
        const serialized = {
          ...data,
          rows: Array.isArray(data.rows) ? data.rows.slice(0, 200) : [],
        };
        localStorage.setItem('dsi_uploaded_data', JSON.stringify(serialized));
      } else {
        localStorage.removeItem('dsi_uploaded_data');
        setPipelineStages([]);
      }
    } catch (e) {
      console.warn('[DataContext] localStorage serialization failed:', e);
    }
  };

  return (
    <DataContext.Provider value={{ uploadedData, setUploadedData, pipelineStages, setPipelineStages }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
