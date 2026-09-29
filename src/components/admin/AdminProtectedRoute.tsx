'use client';

import React, { useState, useEffect } from 'react';
import LoginForm from './LoginForm';

interface AdminProtectedRouteProps {
    children: React.ReactNode;
}

const AdminProtectedRoute: React.FC<AdminProtectedRouteProps> = ({ children }) => {
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const checkSession = async () => {
        try {
            const res = await fetch('/api/admin/auth/me', {
                method: 'GET',
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.authenticated) {
                    setSession(data.user);
                } else {
                    setSession(null);
                }
            } else {
                setSession(null);
            }
        } catch (error) {
            console.error('Error al verificar sesión admin:', error);
            setSession(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkSession();
    }, []);

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white font-sans">
                <div className="w-12 h-12 border-4 border-medical-green-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Verificando Credenciales de Administrador...</p>
            </div>
        );
    }

    if (!session) {
        return <LoginForm onLogin={(user: any) => setSession(user)} />;
    }

    return <>{children}</>;
};

export default AdminProtectedRoute;
