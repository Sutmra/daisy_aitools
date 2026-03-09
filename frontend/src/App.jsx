import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import AdminPage from './pages/AdminPage';
import { storage } from './utils/storage';

function ProtectedRoute({ children, role }) {
    const user = storage.getUser();
    if (!user) return <Navigate to="/login" replace />;
    if (role && user.role !== role) {
        return <Navigate to={user.role === 'admin' ? '/admin' : '/chat'} replace />;
    }
    return children;
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/chat" element={
                    <ProtectedRoute role="user"><ChatPage /></ProtectedRoute>
                } />
                <Route path="/admin" element={
                    <ProtectedRoute role="admin"><AdminPage /></ProtectedRoute>
                } />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
