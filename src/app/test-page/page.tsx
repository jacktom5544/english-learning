export default function TestPage() {
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Test Page</h1>
      <p>This is a simple test page to verify routing is working.</p>
      <p>If you can see this page, basic routing is functioning correctly.</p>
      <div style={{ marginTop: '20px' }}>
        <a href="/" style={{ color: 'blue', textDecoration: 'underline' }}>
          Go to homepage
        </a>
      </div>
    </div>
  );
} 