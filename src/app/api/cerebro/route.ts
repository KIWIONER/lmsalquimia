import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const webhookUrl =
      process.env.PUBLIC_N8N_CEREBRO_URL ||
      process.env.NEXT_PUBLIC_N8N_CEREBRO_URL ||
      process.env.N8N_WEBHOOK_URL ||
      'https://cerebro.agencialquimia.com/webhook/cerebro-nutricionista';

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Servidor de Cerebro n8n no disponible', status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('API Cerebro Route Error:', error);
    return NextResponse.json(
      { 
        error: 'El Cerebro de Alquimia está procesando una consulta extensa o no se pudo conectar.',
        details: error.message 
      },
      { status: 503 }
    );
  }
}
