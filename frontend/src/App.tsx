import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Layout from '@/components/Layout';
import TopProgress, { RouteFallback } from '@/components/TopProgress';

// Chargement paresseux : chaque page a son propre chunk.
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const Chat = lazy(() => import('@/pages/Chat'));
const CalendarPage = lazy(() => import('@/pages/Calendar'));
const CallRoom = lazy(() => import('@/pages/CallRoom'));
const Boards = lazy(() => import('@/pages/Boards'));
const BoardDetail = lazy(() => import('@/pages/BoardDetail'));
const Meal = lazy(() => import('@/pages/Meal'));
const ProjectDetail = lazy(() => import('@/pages/ProjectDetail'));
const Forms = lazy(() => import('@/pages/Forms'));
const FormBuilder = lazy(() => import('@/pages/FormBuilder'));
const FormFill = lazy(() => import('@/pages/FormFill'));
const FormResponses = lazy(() => import('@/pages/FormResponses'));
const PublicFormFill = lazy(() => import('@/pages/PublicFormFill'));

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading)
    return <div className="grid h-screen place-items-center text-[var(--text-dim)]">Chargement…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <>
      <TopProgress />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/f/:formId" element={<PublicFormFill />} />
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
      </Suspense>
    </>
  );
}
