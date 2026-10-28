import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthProvider.jsx';
import AppShell from '../components/AppShell.jsx';
import AuthPage from '../pages/AuthPage.jsx';
import StudentDashboardPage from '../pages/StudentDashboardPage.jsx';
import AssignmentViewerPage from '../pages/AssignmentViewerPage.jsx';
import CodeWorkspacePage from '../pages/CodeWorkspacePage.jsx';
import TeacherAssignmentsPage from '../pages/TeacherAssignmentsPage.jsx';
import SimilarityReviewPage from '../pages/SimilarityReviewPage.jsx';
import TeacherMarkingPage from '../pages/TeacherMarkingPage.jsx';
import StudentSubmissionHistoryPage from '../pages/StudentSubmissionHistoryPage.jsx';
import TeacherReportsPage from '../pages/TeacherReportsPage.jsx';

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
            <Route path="/student/history" element={<StudentSubmissionHistoryPage />} />
            <Route path="/student/assignments/:id" element={<AssignmentViewerPage />} />
            <Route path="/student/assignments/:id/workspace" element={<CodeWorkspacePage />} />
          </Route>
          <Route element={<RequireRole role="teacher" />}>
            <Route path="/teacher/assignments" element={<TeacherAssignmentsPage />} />
            <Route path="/teacher/reports" element={<TeacherReportsPage />} />
            <Route path="/teacher/assignments/:assignmentId/reports" element={<TeacherReportsPage />} />
            <Route path="/teacher/assignments/:assignmentId/marking" element={<TeacherMarkingPage />} />
            <Route path="/teacher/submissions/:submissionId/marking" element={<TeacherMarkingPage />} />
            <Route path="/teacher/assignments/:assignmentId/similarity" element={<SimilarityReviewPage />} />
            <Route path="/teacher/similarity/:reportId" element={<SimilarityReviewPage />} />
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
