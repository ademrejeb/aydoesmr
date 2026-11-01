import { WebSocketServer, type WebSocket } from "ws"

interface PongableSocket extends WebSocket {
  isAlive: boolean
}

const port = parseInt(process.env.PORT ?? "8092", 10)
const heartbeatInterval = 30_000

const wss = new WebSocketServer({ port })

wss.on("connection", (ws: WebSocket) => {
  const sock = ws as PongableSocket
  sock.isAlive = true
  sock.on("pong", () => {
    sock.isAlive = true
  })
  sock.on("message", (data) => {
    wss.clients.forEach((client) => {
      if (client !== sock && client.readyState === client.OPEN) {
        client.send(data.toString())
      }
    })
  })
})

setInterval(() => {
  wss.clients.forEach((ws) => {
    const sock = ws as PongableSocket
    if (sock.isAlive === false) {
      sock.terminate()
      return
    }
    sock.isAlive = false
    sock.ping()
  })
}, heartbeatInterval)

console.log(`techverse-websocket listening on :${port}`)