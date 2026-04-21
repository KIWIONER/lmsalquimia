require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function main() {
    const { data: cards } = await supabase.schema('nutricionista').from('tarjetas').select('*').eq('documento_id', '6b3545df-eaa5-4325-87ed-738b0054afd3');
    console.log("Cards for Saúde Pública:", cards?.length);
    if (cards && cards.length > 0) {
        console.log("First card:", cards[0].titulo);
    }
}
main();
