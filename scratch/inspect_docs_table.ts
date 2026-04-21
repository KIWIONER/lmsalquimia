import { supabase } from '../src/lib/supabase';

async function check() {
    const { data, error } = await supabase.schema('nutricionista').from('documentos').select('*').limit(5);
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}
check();
