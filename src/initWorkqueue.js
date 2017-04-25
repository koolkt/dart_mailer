const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const parse = require('csv-parse');
const debug = require('debug')('debug:redisLoader');
const redis = require('redis');
const config = require('../config/config');

const TEST = process.env.TEST;
const USER = process.env.USER;
const CSV_FILENAME = TEST ? './assets/test.csv' : process.env.CSV_FILE;
if (!TEST) {
    console.log('Init work queue running in production mode')
} else {
    console.log('Init work queue Running in testmode')
}

Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);
const redisClient = redis.createClient();
const WORK_QUEUE = TEST ? 'mailer_test_work_queue' : `marie_work_queue_${ config[USER].gmailUser }`;
debug(`Populating queue: ${ WORK_QUEUE } with ${ CSV_FILENAME }`)
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
        const csvFile = await fs.readFileAsync(CSV_FILENAME);
        const output = await asyncParse(csvFile);
        debug(await redisClient.existsAsync(WORK_QUEUE));
        output.forEach(async (person) => {
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
