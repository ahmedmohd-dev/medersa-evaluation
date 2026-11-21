import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './components/ui';
import { AppLayout, ProtectedRoute } from './components/layout';
import {
  LoginPage,
  DataEntryPage,
  DashboardPage,
  AnalyticsPage,
  UstazesPage,
  QuestionsPage,
  EvaluationsPage,
  CommentsPage,
  AssistantCommentsPage,
  UsersPage,
  AuditLogsPage,
  SettingsPage,
  MyEntriesPage,
  MyActivityPage,
} from './pages';

function RootRedirect() {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={isAdmin ? '/dashboard' : '/data-entry'} replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public Login Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Authenticated Application Layout */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<RootRedirect />} />

              {/* Data Entry (Accessible by both Admin and Data Entry Users) */}
              <Route path="/data-entry" element={<DataEntryPage />} />

              {/* Data Entry User Routes */}
              <Route path="/my-entries" element={<MyEntriesPage />} />
              <Route path="/my-activity" element={<MyActivityPage />} />

              {/* Administrator Only Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute requireAdmin>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics/boys"
                element={
                  <ProtectedRoute requireAdmin>
                    <AnalyticsPage group="boys" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics/girls"
                element={
                  <ProtectedRoute requireAdmin>
                    <AnalyticsPage group="girls" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics/combined"
                element={
                  <ProtectedRoute requireAdmin>
                    <AnalyticsPage group="combined" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ustazes"
                element={
                  <ProtectedRoute requireAdmin>
                    <UstazesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/questions"
                element={
                  <ProtectedRoute requireAdmin>
                    <QuestionsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/evaluations"
                element={
                  <ProtectedRoute requireAdmin>
                    <EvaluationsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/comments"
                element={
                  <ProtectedRoute requireAdmin>
                    <CommentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/assistant-comments"
                element={
                  <ProtectedRoute requireAdmin>
                    <AssistantCommentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute requireAdmin>
                    <UsersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/audit-logs"
                element={
                  <ProtectedRoute requireAdmin>
                    <AuditLogsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute requireAdmin>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
