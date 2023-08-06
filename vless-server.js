const net = require('net');
const WebSocket = require('ws');
const { TextDecoder } = require('util');

const uuid = (process.env.UUID || 'd342d11e-d424-4583-b36e-524ab1f0afa4').replace(/-/g, "");
const port = process.env.PORT || 3000;

const log = (...args) => console.log.bind(console, ...args);
const errorLog = (...args) => console.error.bind(console, ...args);

const validateClientID = (msg) => {
  const [VERSION] = msg;
  const id = msg.slice(1, 17);
  return id.every((v, i) => v === parseInt(uuid.substr(i * 2, 2), 16));
};

const parseHostAndPort = (msg, i) => {
  const port = msg.slice(i, i += 2).readUInt16BE(0);
  const ATYP = msg.slice(i, i += 1).readUInt8();
  const host = ATYP === 1
    ? msg.slice(i, i += 4).join('.') // IPV4
    : (ATYP === 2
      ? new TextDecoder().decode(msg.slice(i + 1, i += 1 + msg.slice(i, i + 1).readUInt8())) // domain
      : (ATYP === 3
        ? msg.slice(i, i += 16).reduce((s, b, i, a) => (i % 2 ? s.concat(a.slice(i - 1, i + 1)) : s), []).map(b => b.readUInt16BE(0).toString(16)).join(':') // IPV6
        : ''));
  return { host, port };
};

const startVLessServer = () => {
  const wss = new WebSocket.Server({ port }, log('listen:', port));

  wss.on('connection', ws => {
    log('on connection');

    ws.once('message', msg => {
      if (!validateClientID(msg)) return;
      const { host, port } = parseHostAndPort(msg, 17);
      log('conn:', host, port);

      ws.send(Buffer.from([msg[0], 0])); // Send response to client

      const duplex = WebSocket.createWebSocketStream(ws);
      net.connect({ host, port }, function () {
        this.write(msg.slice(19)); // Start from index 19 for outbound connection
        duplex.on('error', errorLog('E1:')).pipe(this).on('error', errorLog('E2:')).pipe(duplex);
      }).on('error', errorLog('Conn-Err:', { host, port }));
    }).on('error', errorLog('EE:'));
  });
};

startVLessServer();
