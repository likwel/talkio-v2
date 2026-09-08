import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Chat from '@/pages/Chat';
import CalendarPage from '@/pages/Calendar';
import CallRoom from '@/pages/CallRoom';
import Boards from '@/pages/Boards';
import BoardDetail from '@/pages/BoardDetail';
import Meal from '@/pages/Meal';
import ProjectDetail from '@/pages/ProjectDetail';
import Forms from '@/pages/Forms';
import FormBuilder from '@/pages/FormBuilder';
import FormFill from '@/pages/FormFill';
import FormResponses from '@/pages/FormResponses';

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading)
    return <div className="grid h-screen place-items-center text-[var(--text-dim)]">Chargement…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/call/:roomId" element={<Protected><CallRoom /></Protected>} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Chat />} />
        <Route path="chat" element={<Navigate to="/" replace />} />
        <Route path="chat/:channelId" element={<Chat />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="projects" element={<Boards />} />
        <Route path="projects/:boardId" element={<BoardDetail />} />
        <Route path="boards" element={<Navigate to="/projects" replace />} />
        <Route path="meal" element={<Meal />} />
        <Route path="meal/projects/:projectId" element={<ProjectDetail />} />
        <Route path="forms" element={<Forms />} />
        <Route path="forms/new" element={<FormBuilder />} />
        <Route path="forms/:formId/edit" element={<FormBuilder />} />
        <Route path="forms/:formId/fill" element={<FormFill />} />
        <Route path="forms/:formId/responses" element={<FormResponses />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
