import { neon } from '@neondatabase/serverless';

const getSql = () => neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql`SELECT name, score FROM scores ORDER BY score DESC LIMIT 10`;
    return Response.json(rows);
  } catch {
    return Response.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const { name, score } = await request.json();

    if (!name || score === undefined || score === null) {
      return Response.json({ error: 'Missing name or score' }, { status: 400 });
    }

    const trimmedName = name.toString().trim().slice(0, 20);
    const finalScore = parseInt(score, 10);
    const sql = getSql();

    await sql`INSERT INTO scores (name, score) VALUES (${trimmedName}, ${finalScore})`;

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Failed to save score' }, { status: 500 });
  }
}