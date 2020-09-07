require('dotenv').config()
const protobuf = require("protobufjs");
const amqp = require('amqplib/callback_api');
const mongoose = require("mongoose");
const http = require('http');



(async () => {
  await mongoConnect()
  await consumer()
})()

async function mongoConnect() {
  try {
    await mongoose.connect(process.env.URI_MONGODB, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
      useCreateIndex: true,
    });
    console.log("Connected to mongo database successfully");
    return
  } catch(e) {
    console.log('Error happend while connecting to the DB: ', e.message)
  }
}

async function consumer() {
  amqp.connect(process.env.URI_RABBITMQ, async (error0, connection) => {
    if (error0) {
      throw error0;
    }
    console.log('RabbitMQ connected')
    try {
      // Create/Bind a consumer queue for an exchange broker
      channel = await connection.createChannel()
      const queue = await channel.assertQueue('', {exclusive: true})
      channel.bindQueue(queue.queue, process.env.EXCHANGE_NAME, '')

      console.log(" [*] Waiting for messages in %s. To exit press CTRL+C");
      channel.consume('', consumeMessage, {noAck: true});
    } catch(error) {
      console.error(error)
      console.error("unable to save to mongoDB");
    }
  });
}


async function decodeMsgFromBuffer(buffer) {
  try {
    const root = await protobuf.load(process.env.PROTO_FILE_PATH)
    var ListingMessage = root.lookupType("Listing");
    var decodedMsg = ListingMessage.decode(buffer);
    return decodedMsg
  } catch(error) {
    console.error(error)
  }
}

async function saveInMongoDB(json) {
  const listingData = new Listing(json);
  const doc = await listingData.save()
  console.log("item saved to database");
  return doc
}

async function sendClearCache(_id) {
  return await http.get(`http://localhost:${process.env.SERVER_PORT_LISTING_SEARCH_API}/clean-cache/${_id}`)
}

async function consumeMessage(buffer) {
  console.log('Consumer:')
  const decodedData = await decodeMsgFromBuffer(buffer.content)
  const doc = await saveInMongoDB(decodedData)
  await sendClearCache(doc._id)
  return
}

process.on('SIGINT', () => {
  mongoose.connection.close(() => {
    console.log('Mongoose disconnected on app termination');
    process.exit(0);
  });
});


const listingSchema = new mongoose.Schema({
  city: String,
  address: String,
  rooms: Number,
  floor: Number,
  price: Number,
  phone: String,
  email: String,
  description: String,
});
const Listing = mongoose.model("Listing", listingSchema);