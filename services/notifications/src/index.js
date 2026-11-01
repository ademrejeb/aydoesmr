const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'techdebt-notifications',
      version: '0.1.0',
    }));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

const PORT = process.env.PORT || 8089;
server.listen(PORT, () => {
  console.log(`Notification service running on :${PORT}`);
});
