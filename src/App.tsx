import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@store/useAuthStore';
import SchedulesList from '@pages/SchedulesList';
import MainSchedule from '@pages/MainSchedule';
import EmployeesPage from '@pages/EmployeesPage';
import ShiftProfilesPage from '@pages/ShiftProfilesPage';
import VacationMode from '@pages/VacationMode';
import HistoryView from '@pages/HistoryView';
import PermissionsManager from '@pages/PermissionsManager';
import LoginPage from '@pages/LoginPage';
import NotFound from '@pages/NotFound';

/**
 * Главный компонент приложения
 */
function App() {
  const { isAuthenticated, initialize } = useAuthStore();

  // Инициализация авторизации при загрузке
  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            isAuthenticated ? <SchedulesList /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/schedule/:scheduleId"
          element={
            isAuthenticated ? <MainSchedule /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/schedule/:scheduleId/employees"
          element={
            isAuthenticated ? <EmployeesPage /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/schedule/:scheduleId/profiles"
          element={
            isAuthenticated ? <ShiftProfilesPage /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/schedule/:scheduleId/vacations"
          element={
            isAuthenticated ? <VacationMode /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/schedule/:scheduleId/history"
          element={
            isAuthenticated ? <HistoryView /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/schedule/:scheduleId/users"
          element={
            isAuthenticated ? <PermissionsManager /> : <Navigate to="/login" replace />
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

