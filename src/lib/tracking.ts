import { supabase } from './supabase';

export const trackEvent = async (eventName: string, details: Record<string, any> = {}): Promise<void> => {
    try {
        const { error } = await supabase
            .from('tracking')
            .insert([
                { 
                    event_name: eventName, 
                    details: details,
                    timestamp: new Date().toISOString()
                }
            ]);
        
        if (error) throw error;
        console.log(`Tracked: ${eventName}`, details);
    } catch (err: any) {
        console.error('Tracking Error:', err.message);
    }
};
