import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthProvider.jsx';
import AppShell from '../components/AppShell.jsx';
import AuthPage from '../pages/AuthPage.jsx';
import StudentDashboardPage from '../pages/StudentDashboardPage.jsx';
import AssignmentViewerPage from '../pages/AssignmentViewerPage.jsx';
import TeacherAssignmentsPage from '../pages/TeacherAssignmentsPage.jsx';

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'teacher' ? '/teacher/assignments' : '/student/dashboard'} replace />;
}

function RequireSession() {
  const { user, loading } = useAuth();
  if (loading) return <div className="screen-loader">Checking your LabTrack session…</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function RequireRole({ role }) {
  const { user } = useAuth();
  return user?.role === role ? <Outlet /> : <Navigate to={user?.role === 'teacher' ? '/teacher/assignments' : '/student/dashboard'} replace />;
}

function RouteTable() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={loading ? <div className="screen-loader">Checking your LabTrack session…</div> : user ? <HomeRedirect /> : <AuthPage mode="login" />} />
      <Route path="/register" element={loading ? <div className="screen-loader">Checking your LabTrack session…</div> : user ? <HomeRedirect /> : <AuthPage mode="register" />} />
      <Route element={<RequireSession />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route element={<RequireRole role="student" />}>
            <Route path="/student/dashboard" element={<StudentDashboardPage />} />
            <Route path="/student/assignments/:id" element={<AssignmentViewerPage />} />
          </Route>
          <Route element={<RequireRole role="teacher" />}>
            <Route path="/teacher/assignments" element={<TeacherAssignmentsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return <AuthProvider><BrowserRouter><RouteTable /></BrowserRouter></AuthProvider>;
}
