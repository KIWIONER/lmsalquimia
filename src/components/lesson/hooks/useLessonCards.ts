import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';

export interface LessonBlock {
    id: string | number;
    titulo: string;
    contenido: string;
    orden?: number;
    documento_id?: string;
    [key: string]: any;
}

export const useLessonCards = (docId?: string) => {
    const [blocks, setBlocks] = useState<LessonBlock[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTarjetas = useCallback(async () => {
        if (!docId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const { data, error } = await supabase
                .schema('nutricionista')
                .from('tarjetas')
                .select('*')
                .eq('documento_id', docId)
                .order('orden', { ascending: true });
            
            if (error) throw error;
            setBlocks(data || []);
        } catch (err) {
            console.error('Error fetching tarjetas:', err);
        } finally {
            setLoading(false);
        }
    }, [docId]);

    useEffect(() => {
        fetchTarjetas();
    }, [fetchTarjetas]);

    return { blocks, loading, refetch: fetchTarjetas };
};
