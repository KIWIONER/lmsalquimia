import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { splitIntoBlocks } from '../../../lib/content';

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
            // 1. Obtener tarjetas publicadas vía API segura del servidor (evita bloqueo RLS de anon)
            const res = await fetch(`/api/lesson/tarjetas?doc_id=${encodeURIComponent(docId)}`);
            const json = res.ok ? await res.json() : null;
            const data = json?.cards;

            if (Array.isArray(data) && data.length > 0) {
                setBlocks(data);
            } else {
                // 2. Fallback resiliente: Obtener contenido consolidado de documentos publicados y desfragmentar en bloques
                const { data: docData, error: docError } = await supabase
                    .schema('nutricionista')
                    .from('documentos')
                    .select('contenido')
                    .eq('id', docId)
                    .eq('estado', 'publicado')
                    .single();

                if (!docError && docData && docData.contenido && docData.contenido.trim().length > 0) {
                    const parsedBlocks = splitIntoBlocks(docData.contenido);
                    const formattedBlocks: LessonBlock[] = parsedBlocks.map((b, idx) => ({
                        id: b.id,
                        titulo: b.title,
                        contenido: b.content,
                        orden: idx,
                    }));
                    setBlocks(formattedBlocks);
                } else {
                    setBlocks([]);
                }
            }
        } catch (err) {
            console.error('Error fetching tarjetas:', err);
            setBlocks([]);
        } finally {
            setLoading(false);
        }
    }, [docId]);

    useEffect(() => {
        fetchTarjetas();
    }, [fetchTarjetas]);

    return { blocks, loading, refetch: fetchTarjetas };
};
