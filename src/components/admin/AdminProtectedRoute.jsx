import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import LoginForm from './LoginForm';

const AdminProtectedRoute = ({ children }) => {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950">
             <div className="w-16 h-16 border-4 border-medical-green-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    if (!session) return <LoginForm onLogin={setSession} />;

    return <>{children}</>;
};

export default AdminProtectedRoute;
