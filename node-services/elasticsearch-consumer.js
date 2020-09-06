require('dotenv').config()
const protobuf = require("protobufjs");
const amqp = require('amqplib/callback_api');
const elasticsearch = require('elasticsearch');


let elasticsearchClient;

(async () => {
  await elasticsearchConnect()
  await consumer()
})()

async function elasticsearchConnect() {
  try {
    elasticsearchClient = new elasticsearch.Client({
      host: process.env.URI_ELASTICSEARCH,
      log: 'trace',
    });
    await elasticsearchClient.ping({ requestTimeout: 3000 });
    console.log('Elasticsearch client connected.');
    try {
      const resp = await elasticsearchClient.indices.create({index: process.env.ELASTIC_INDEX_KEY})
      console.log("create",resp);
    } catch(error) {
      console.error(`index: ${process.env.ELASTIC_INDEX_KEY} already exist`)
    }
  } catch(e) {
    console.log('Error happend while connecting to elasticsearch', e.message)
  }
}

async function consumer() {
  amqp.connect(process.env.URI_RABBITMQ, async (error0, connection) => {
    if (error0) {
      throw error0;
    }
    console.log('RabbitMQ connected')
    try {
      // Create/Bind a consumer queue to an exchange broker
      channel = await connection.createChannel()
      await channel.assertExchange(process.env.EXCHANGE_NAME, 'fanout', { durable: false });
      const queue = await channel.assertQueue('', {exclusive: true})
      channel.bindQueue(queue.queue, process.env.EXCHANGE_NAME, '')

      console.log(" [*] Waiting for messages in %s. To exit press CTRL+C");
      channel.consume('', consumeMessage, {noAck: true});
    } catch(error) {
      console.error(error)
      console.error("unable save doc to elasticsearch");
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

async function saveInElasticsearchDB(json) {
  console.log(json)
  await elasticsearchClient.index({
    index: process.env.ELASTIC_INDEX_KEY,
    type: process.env.ELASTIC_DOC_TYPE,
    body: json
  });
  console.log("item saved to elasticsearch");
}

async function consumeMessage(buffer) {
  console.log('Consumer:')
  const decodedData = await decodeMsgFromBuffer(buffer.content)
  await saveInElasticsearchDB(decodedData)
}

process.on('SIGINT', () => {
  mongoose.connection.close(() => {
    process.exit(0);
  });
});