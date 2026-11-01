const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({ port: parseInt(process.env.PORT || '8092') });

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (data) => {
    console.log('Received:', data.toString());
    ws.send(JSON.stringify({ type: 'ack', timestamp: new Date().toISOString() }));
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.send(JSON.stringify({
    type: 'welcome',
    service: 'techdebt-websocket',
    version: '0.1.0',
  }));
});

console.log('WebSocket server starting on :8092');
