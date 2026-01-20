export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Closet API Server</h1>
      <p>Available endpoints:</p>
      <ul>
        <li><code>GET /api/health</code> - Health check</li>
        <li><code>POST /api/analyze</code> - Analyze clothing image</li>
        <li><code>POST /api/search</code> - Search for products</li>
      </ul>
    </main>
  );
}
