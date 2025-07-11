import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import DashboardLayout from './components/Layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Chat from './pages/Chat';
import Configs from './pages/Configs';
import FlowBuilder from './pages/FlowBuilder';
import Transcribe from './pages/Transcribe';
import Describe from './pages/Describe';
import Calories from './pages/Calories';
import Resources from './pages/Resources';
import './styles/main.scss';

// Import Font Awesome CSS
import '@fortawesome/fontawesome-free/css/all.min.css';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <DashboardLayout>
                  <Dashboard />
                </DashboardLayout>
              }
            />
            <Route
              path="/analytics"
              element={
                <DashboardLayout>
                  <Analytics />
                </DashboardLayout>
              }
            />
            <Route
              path="/users"
              element={
                <DashboardLayout>
                  <Users />
                </DashboardLayout>
              }
            />
            <Route
              path="/settings"
              element={
                <DashboardLayout>
                  <Settings />
                </DashboardLayout>
              }
            />
            <Route
              path="/chat"
              element={
                <DashboardLayout>
                  <Chat />
                </DashboardLayout>
              }
            />
            <Route
              path="/configs"
              element={
                <DashboardLayout>
                  <Configs />
                </DashboardLayout>
              }
            />
            <Route
              path="/flow-builder"
              element={
                <DashboardLayout>
                  <FlowBuilder />
                </DashboardLayout>
              }
            />
            <Route
              path="/transcribe"
              element={
                <DashboardLayout>
                  <Transcribe />
                </DashboardLayout>
              }
            />
            <Route
              path="/describe"
              element={
                <DashboardLayout>
                  <Describe />
                </DashboardLayout>
              }
            />
            <Route
              path="/calories"
              element={
                <DashboardLayout>
                  <Calories />
                </DashboardLayout>
              }
            />
            <Route
              path="/resources"
              element={
                <DashboardLayout>
                  <Resources />
                </DashboardLayout>
              }
            />
            {/* Catch all route */}
            <Route
              path="*"
              element={
                <DashboardLayout>
                  <Dashboard />
                </DashboardLayout>
              }
            />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
