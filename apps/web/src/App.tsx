import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { AuthProvider } from '@/features/auth/auth-context';
import { ActivityPage } from '@/pages/activity-page';
import { AdminPage } from '@/pages/admin-page';
import { AllEstimatesPage } from '@/pages/all-estimates-page';
import { AppPage } from '@/pages/app-page';
import { EditorPage } from '@/pages/editor-page';
import { EstimatesPage } from '@/pages/estimates-page';
import { InvitePage } from '@/pages/invite-page';
import { NotificationsPage } from '@/pages/notifications-page';
import { OrganizationsPage } from '@/pages/organizations-page';
import { LandingPage } from '@/pages/landing-page';
import { MaterialsPage } from '@/pages/materials-page';
import { LoginPage } from '@/pages/login-page';
import { ProjectPage } from '@/pages/project-page';
import { RegisterPage } from '@/pages/register-page';
import { SettingsPage } from '@/pages/settings-page';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<AppPage />} />
            <Route
              path="/app/dashboard"
              element={<Navigate to="/app" replace />}
            />
            <Route path="/app/projects/:projectId" element={<ProjectPage />} />
            <Route
              path="/app/projects/:projectId/editor"
              element={<EditorPage />}
            />
            <Route
              path="/app/projects/:projectId/estimates"
              element={<EstimatesPage />}
            />
            <Route
              path="/app/projects/:projectId/activity"
              element={<ActivityPage />}
            />
            <Route path="/app/organizations" element={<OrganizationsPage />} />
            <Route path="/app/team" element={<OrganizationsPage />} />
            <Route path="/app/notifications" element={<NotificationsPage />} />
            <Route path="/app/materials" element={<MaterialsPage />} />
            <Route path="/app/settings" element={<SettingsPage />} />
            <Route path="/app/estimates" element={<AllEstimatesPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/users" element={<AdminPage />} />
            <Route path="/admin/organizations" element={<AdminPage />} />
            <Route path="/invite/:token" element={<InvitePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
