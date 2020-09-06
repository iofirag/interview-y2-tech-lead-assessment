require('dotenv').config()
const express = require("express");
const bodyParser = require('body-parser');
const mongoose = require("mongoose");
const elasticsearch = require('elasticsearch');
const asyncRedis = require("async-redis");
const responseTime = require('response-time');

let elasticsearchClient;
let redisClient;

(async () => {
  await mongoConnect()          // DB
  await elasticsearchConnect()  // DB
  await redisConnect()          // Cache
  await server()                // REST-API
})()

async function redisConnect() {
  try {
    redisClient = asyncRedis.createClient()
    redisClient.on("error", (err) => {
      console.log("Error " + err);
    });
    console.log('Redis connected')
  } catch(error) {
    console.log('Error while connecting to Redis')
    console.error(error)
  }
}
async function elasticsearchConnect() {
  try {
    elasticsearchClient = new elasticsearch.Client({
      host: process.env.URI_ELASTICSEARCH,
      log: 'trace',
    });
    await elasticsearchClient.ping({ requestTimeout: 3000 });
    console.log('Elasticsearch client connected.');
  } catch(e) {
    console.log('Error happend while connecting to elasticsearch', e.message)
  }
}
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

async function server() {
  // Server
  const app = express();
  app.use(bodyParser.urlencoded({extended: true}))
  app.use(bodyParser.json())
  app.use(responseTime())
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });
  
  // Rest api
  app
  .get('/clean-cache/:_id', async (req, res) => {
    try {
      const { _id } = req.params
      if (!_id) throw `missing id: ${_id}`
      // should be in transaction
      const delIdResult = await redisClient.del(_id);
      const delAllResult = await redisClient.del('all');
      return res.status(200).json({success: 1});
    }catch(error) {
      console.error(error)
      res.status(400).json({success: false, error})
    }
  })
  .get('/all', async (req, res) => {
    try {
      const redisValue = await redisClient.get('all');
      let responseJson;
      if (redisValue) {
        // return from cache
        responseJson = JSON.parse(redisValue)
      } else {
        const listingDocList = await Listing.find({})
        redisClient.setex('all', process.env.CACHE_SECONDS, JSON.stringify({source: 'Redis Cache', data: listingDocList}))
        responseJson = {source:'db', data: listingDocList}
      }
      return res.status(200).json(responseJson);
    }catch(error) {
      console.error(error)
      res.status(400).json({success: false, error})
    }
  })
  .get('/getByFields', async (req, res) => {
    try {
      const { city, rooms } = req.query
      if (!city || !rooms) throw 'Error: missing data';
      const q = `city:${city}~ AND rooms:${rooms}`;
      
      const redisValue = await redisClient.get(`getByFields ${q}`);
      let responseJson;
      if (redisValue) {
        // return from cache
        responseJson = JSON.parse(redisValue)
      } else {
        const response = await elasticsearchClient.search({ index: process.env.ELASTIC_INDEX_KEY, q });
        if (!response && response.hits && response.hits.hits) throw 'no results'

        redisClient.setex(`getByFields ${q}`, process.env.CACHE_SECONDS, JSON.stringify({source: 'Redis Cache', data: response.hits.hits}))
        responseJson = {source:'db', data: response.hits.hits}
      }
      return res.status(200).json(responseJson);
    }catch(error) {
      console.error(error)
      res.status(400).json({success: false, error})
    }
  })
  .get('/getById', async (req, res) => {
    try {
      const { _id } = req.query
      const redisValue = await redisClient.get(_id);
      let responseJson;
      if (redisValue) {
        // return from cache
        responseJson = JSON.parse(redisValue)
      } else {
        const listingDoc = await Listing.findOne({_id})
        redisClient.setex(_id, process.env.CACHE_SECONDS, JSON.stringify({source: 'Redis Cache', data: listingDoc._doc}))
        responseJson = {source:'db', data: listingDoc._doc}
      }
      return res.status(200).json(responseJson);
    }catch(error) {
      console.error(error)
      res.status(400).json({success: false, error})
    }
  })
  .listen(process.env.SERVER_PORT_LISTING_SEARCH_API, () => {
    console.log(`Server running on port ${process.env.SERVER_PORT_LISTING_SEARCH_API}`);
   });
}


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