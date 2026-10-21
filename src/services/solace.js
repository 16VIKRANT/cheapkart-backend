const mqtt = require('mqtt');
let client;

function connectSolace() {
  if (!process.env.SOLACE_MQTT_URL) { console.warn('Solace is not configured; event delivery is disabled.'); return Promise.resolve(null); }
  return new Promise((resolve) => {
    client = mqtt.connect(process.env.SOLACE_MQTT_URL, {
      username: process.env.SOLACE_MQTT_USERNAME,
      password: process.env.SOLACE_MQTT_PASSWORD,
      clientId: process.env.SOLACE_MQTT_CLIENT_ID || `cheapkart-${process.pid}`,
      reconnectPeriod: 3000,
      connectTimeout: 10000,
      clean: true,
    });
    let settled = false;
    client.on('connect', () => { console.log('Connected to Solace PubSub+ MQTT'); if (!settled) { settled = true; resolve(client); } });
    client.on('error', (err) => { console.error('Solace MQTT error:', err.message); if (!settled) { settled = true; resolve(null); } });
    setTimeout(() => { if (!settled) { settled = true; console.warn('Solace connection is pending; API will continue.'); resolve(null); } }, 10000).unref();
  });
}

function publish(topic, payload) {
  return new Promise((resolve, reject) => {
    if (!client || !client.connected) return reject(new Error('Solace broker is not connected'));
    client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => err ? reject(err) : resolve());
  });
}
function getClient() { return client; }
function disconnectSolace() { return new Promise((resolve) => { if (!client) return resolve(); client.end(false, {}, resolve); }); }
module.exports = { connectSolace, publish, getClient, disconnectSolace };
