import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout, { NAV } from './components/Layout';
import { Spinner } from './components/ui';
import Login, { ForgotPassword, ResetPassword } from './pages/Login';
import ReportCards from './pages/ReportCards';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Monitoring from './pages/Monitoring';
import MyAttendance from './pages/MyAttendance';
import Marks from './pages/Marks';
import Results from './pages/Results';
import Resources from './pages/Resources';
import Announcements from './pages/Announcements';
import Timetable from './pages/Timetable';
import CalendarPage from './pages/CalendarPage';
import Students from './pages/Students';
import Academic from './pages/Academic';
import Finance from './pages/Finance';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';
import Users from './pages/Users';
import AuditLogs from './pages/AuditLogs';
import Account from './pages/Account';
import Landing from './pages/Landing';
import Inquiries from './pages/Inquiries';
import { ForcePasswordChange } from './pages/Account';

function Guard({ path, children }) {
  const { user } = useAuth();
  const item = NAV.find((n) => n.to === path);
  const ok = !item || item.roles === '*' || user.role === 'admin' || item.roles.includes(user.role);
  return ok ? children : <Navigate to="/dashboard" replace />;
}

function Private() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return user.mustChangePassword ? <ForcePasswordChange /> : <Layout />;
}

const g = (path, el) => <Route path={path} element={<Guard path={path}>{el}</Guard>} />;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route element={<Private />}>
        {g('/dashboard', <Dashboard />)}
        {g('/inquiries', <Inquiries />)}
        {g('/attendance', <Attendance />)}
        {g('/monitoring', <Monitoring />)}
        {g('/my-attendance', <MyAttendance />)}
        {g('/marks', <Marks />)}
        {g('/results', <Results />)}
        {g('/report-cards', <ReportCards />)}
        {g('/resources', <Resources category="lesson" />)}
        {g('/entertainment', <Resources category="entertainment" />)}
        {g('/announcements', <Announcements />)}
        {g('/timetable', <Timetable />)}
        {g('/calendar', <CalendarPage />)}
        {g('/students', <Students />)}
        {g('/academic', <Academic />)}
        {g('/finance', <Finance />)}
        {g('/inventory', <Inventory />)}
        {g('/reports', <Reports />)}
        {g('/users', <Users />)}
        {g('/audit', <AuditLogs />)}
        <Route path="/account" element={<Account />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
