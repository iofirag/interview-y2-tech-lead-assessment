require('dotenv').config()
const express = require("express");
const bodyParser = require('body-parser');
const protobuf = require("protobufjs");
const amqp = require('amqplib/callback_api');


let channel

(async () => {
  await rabbitMQConnect()
  await server()
})()

async function rabbitMQConnect() {
  // RabbitMQ
  amqp.connect(process.env.URI_RABBITMQ, async (error0, connection) => {
    if (error0) {
      throw error0;
    }
    console.log('RabbitMQ connected')
    try {
      // Create exchange for queues
      channel = await connection.createChannel()
      await channel.assertExchange(process.env.EXCHANGE_NAME, 'fanout', { durable: false });
    } catch(error) {
      console.error(error)
    }
  })
}

async function server() {
  // Server
  const app = express();
  app.use(bodyParser.urlencoded({extended: true}))
  app.use(bodyParser.json())
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });
  // Rest api
  app
  .post('/publish-post', async (req, res) => {
    try {
      const buffer = await encodeJsonToBuffer(req.body)
      console.log('Publisher:')
      // Publish buffer to an exchange
      await channel.publish(process.env.EXCHANGE_NAME, '', buffer)
      return res.status(200).json({success: true});
    } catch(error) {
      console.error(error)
      res.status(400).json({success: false, error: error})
    }
  })
  .listen(process.env.SERVER_PORT_LISTING_PUBLISH_API, () => {
    console.log(`Server running on port ${process.env.SERVER_PORT_LISTING_PUBLISH_API}`);
  });
}




async function encodeJsonToBuffer(payload) {
  const root = await protobuf.load(process.env.PROTO_FILE_PATH)
  const ListingMessage = root.lookupType("Listing");
  const errMsg = ListingMessage.verify(payload);
  if (errMsg)
      throw errMsg;
  const message = ListingMessage.create(payload); // or use .fromObject if conversion is necessary
  return ListingMessage.encode(message).finish();
}