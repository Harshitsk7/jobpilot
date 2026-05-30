import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import JobSearch from './pages/JobSearch';
import Applications from './pages/Applications';
import ResumePage from './pages/ResumePage';
import Settings from './pages/Settings';
import ATSScore from './pages/ATSScore';
import LaTeXEditor from './pages/LaTeXEditor';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="jobs" element={<JobSearch />} />
        <Route path="applications" element={<Applications />} />
        <Route path="resume" element={<ResumePage />} />
        <Route path="ats" element={<ATSScore />} />
        <Route path="latex" element={<LaTeXEditor />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
