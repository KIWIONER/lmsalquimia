import { supabase } from './supabase';

export const trackEvent = async (eventName: string, details: Record<string, any> = {}): Promise<void> => {
    try {
        const { error } = await supabase
            .schema('nutricionista')
            .from('tracking')
            .insert([
                { 
                    event_name: eventName, 
                    details: details,
                    timestamp: new Date().toISOString()
                }
            ]);
        
        if (error) {
            console.warn('Aviso Tracking (nutricionista.tracking):', error.message);
            return;
        }
        console.log(`Tracked: ${eventName}`, details);
    } catch (err: any) {
        console.warn('Aviso Tracking:', err?.message || err);
    }
};
