import { createContext, useContext, useState } from 'react';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [uploadedData, setUploadedData] = useState(null);
  // uploadedData shape:
  // {
  //   fileName: string,
  //   columns: string[],
  //   rows: object[],
  //   rowCount: number,
  //   kpis: [{ label, value, trend, trendValue }],
  //   insights: string[],
  //   recommendations: [{ title, desc }],
  //   chartData: [{ name, value }][],
  //   summary: string,
  //   analysisRaw: string,
  // }

  return (
    <DataContext.Provider value={{ uploadedData, setUploadedData }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
