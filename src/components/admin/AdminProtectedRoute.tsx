'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import LoginForm from './LoginForm';

interface AdminProtectedRouteProps {
    children: React.ReactNode;
}

const AdminProtectedRoute: React.FC<AdminProtectedRouteProps> = ({ children }) => {
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        
        async function fetchSession() {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (isMounted) {
                setSession(currentSession);
                setLoading(false);
            }
        }

        fetchSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
            if (isMounted) {
                setSession(currentSession);
                setLoading(false);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white font-sans">
                <div className="w-12 h-12 border-4 border-medical-green-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Verificando Credenciales...</p>
            </div>
        );
    }

    if (!session) {
        return <LoginForm onLogin={(newSession: any) => setSession(newSession)} />;
    }

    return <>{children}</>;
};

export default AdminProtectedRoute;
