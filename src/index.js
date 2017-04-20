const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const parse = require('csv-parse');
const debug = require('debug')('debug:redisLoader');
const redis = require('redis');
const config = require('../config/config');

Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);
const redisClient = redis.createClient();
const WORK_QUEUE = `marie_work_queue_${ config.GMAIL_USER }`;

function asyncParse (fileName) {
    return new Promise((resolve, reject) => {
        parse(fileName, {
            columns: true,
            delimiter: ',',
        }, (err, data) => {
            if (err)
                reject(err);
            else
                resolve(data);
        });
    });
}

function capitalizeFirstLetter (name) {
    return name.charAt(0)
               .toUpperCase()
               .concat(name.toLowerCase().slice(1));
}

function capitalizePerson (person) {
    person.name = capitalizeFirstLetter(person.name);
    return person;
}

async function loadDbToRedis () {
    try {
        const csvFile = await fs.readFileAsync(config.CSV_FILE);
        const output = await asyncParse(csvFile);
        debug(await redisClient.existsAsync(WORK_QUEUE));
        output.slice(1300).forEach(async (person) => {
            await redisClient.rpushAsync(WORK_QUEUE, JSON.stringify(capitalizePerson(person)));
            debug(`added ${ JSON.stringify(person) }`)
        });
        debug(await redisClient.existsAsync(WORK_QUEUE))
        redisClient.quit()
    } catch (e) {
        debug(e)
    }
}

loadDbToRedis()
