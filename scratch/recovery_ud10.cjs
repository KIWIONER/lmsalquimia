const { createClient } = require('@supabase/supabase-js');

const url = 'https://ybqzcxabblyzqhezanaf.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicXpjeGFiYmx5enFoZXphbmFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ2NDUxNiwiZXhwIjoyMDg2MDQwNTE2fQ.p3iwhlIHlAL93prx81H-w6Z-ebWOlWLfK_L3OOI13Og';
const supabase = createClient(url, key);

const docId = '6cd1c7f9-73cf-448d-babd-4106fd65eb78';

// Replicating splitIntoBlocks logic from content.js
const splitIntoBlocks = (text) => {
    if (!text) return [{ title: 'Inicio', content: '' }];
    if (text.includes('## ')) {
        return text.split(/^##\s+/m).filter(Boolean).map((block, i) => {
            const lines = block.split('\n');
            const title = lines[0].trim();
            const content = lines.slice(1).join('\n').trim();
            return { title: title || (i === 0 ? 'Índice' : `Sección ${i}`), content };
        });
    }
    return [{ title: 'Contenido', content: text }];
};

async function recover() {
    console.log('--- RECOVERING UD10 ---');
    const { data: doc, error: fetchErr } = await supabase.schema('nutricionista').from('documentos').select('contenido').eq('id', docId).single();
    if (fetchErr || !doc) {
        console.error('Error fetching document:', fetchErr);
        return;
    }

    const blocks = splitIntoBlocks(doc.contenido);
    console.log(`Found ${blocks.length} blocks to recover.`);

    const newCards = blocks.map((b, i) => ({
        documento_id: docId,
        titulo: b.title,
        contenido: b.content,
        orden: i,
        updated_at: new Date().toISOString()
    }));

    // Clear existing (just in case) then insert
    const { error: delErr } = await supabase.schema('nutricionista').from('tarjetas').delete().eq('documento_id', docId);
    if (delErr) console.error('Error clearing cards:', delErr);

    const { error: insErr } = await supabase.schema('nutricionista').from('tarjetas').insert(newCards);
    if (insErr) {
        console.error('Error inserting cards:', insErr);
    } else {
        console.log('SUCCESS: UD10 Cards recovered.');
    }
}

recover();
