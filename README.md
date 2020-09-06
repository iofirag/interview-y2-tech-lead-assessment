<p align="center"><a href="https://www.yad2.co.il" target="_blank" rel="noopener noreferrer"><img width="100" src="https://assets.yad2.co.il/yad2site/y2assets/images/header/yad2Logo.png" alt="Yad2 logo"></a></p>

<h2 align="center">Tech Lead Technical Skills Assessment</h2>

Candidate name: [your name here]

Architecture: https://www.lucidchart.com/documents/view/9076997e-eb19-444d-a2d4-40f800ba87cd/0_0

## Prerequisites

- github account + 2fa
- node.js + npm/yarn(preferable)
- docker

## Assessment Specs

- create a new api called 'listing-publish' for publish real estate listings
- the published listing must be validated and encoded using Google's protocol buffers, then sent to RabbitMQ (dockerized)
- create a new service for consuming the messages from RabbitMQ and storing them into MongoDB (dockerized)
- create an additional search service for querying the listings from the MongoDB instance
- using Redis (dockerized), add a cache layer for caching the MongoDB query results

### Bonus

- create an additional service for consuming the RabbitMQ messages and storing them into Elasticsearch (dockerized)
  - please note that the service must consume messages from a new queue so messages coming from 'listing-publish' will reach both Elasticsearch and MongoDB consumers
- add full text search capabilities to least on 2 fields on search service.
- now MongoDB will only query by id of document, please note that the listing id must be the same as the id on Elasticsearch and MongoDB.

## Notes

- An example of how to encode messages using protocol buffers can be found at [https://www.npmjs.com/package/protobufjs#examples](https://www.npmjs.com/package/protobufjs#examples)
 
