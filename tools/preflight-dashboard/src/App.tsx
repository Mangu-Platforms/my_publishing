import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppContext, useAppStateProvider } from '@/hooks/useAppState';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import PhaseDetail from '@/pages/PhaseDetail';
import ReadinessReport from '@/pages/ReadinessReport';
import Settings from '@/pages/Settings';

export default function App() {
  const appState = useAppStateProvider();

  return (
    <AppContext.Provider value={appState}>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/phase/:id" element={<PhaseDetail />} />
            <Route path="/report" element={<ReadinessReport />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </HashRouter>
    </AppContext.Provider>
  );
}
