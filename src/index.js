const Promise = require('bluebird');
const nodemailer = require('nodemailer');
const redis = require('redis');
const moment = require('moment');
const debug = require('debug')('debug:mail_client');
const config = require('../config/config').config;
const mailRomain = require('../config/config_mail_romain');
const mailBastien = require('../config/config_mail_bastien');

const TEST = process.env.TEST;
const USER = process.env.USER;

const mailConfs = {
    romain: mailRomain,
    bastien: mailBastien,
};
const mail = mailConfs[USER];

const WORK_QUEUE = TEST ? 'mailer_test_work_queue' : `marie_work_queue_${ config[USER].gmailUser }`;
const PROCESSING_QUEUE = TEST ? 'mailer_test_processing_queue' : `marie_processing_queue_${ process.env.CLIENT_NAME || config[USER].gmailUser }`;
const MAX_MAILS_PER_DAY = 1800; // TODO get max mails from env need to transform param to int

debug(`Starting mailer with user: ${ USER }`)
debug(`Working queue: ${ WORK_QUEUE }`)
debug(`Processing queue: ${ PROCESSING_QUEUE }`)
debug(`Max mails per day: ${ MAX_MAILS_PER_DAY }`)

if (!TEST) {
    console.log('Running in production mode')
}
if (!USER) {
    console.log('env variable USER is not set!');
    process.exit();
}
if(!mail) {
    console.log('User conf not found');
    process.exit();
}

Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);
const redisClient = redis.createClient();
const transporter = nodemailer.createTransport({
    pool: true,
    service: 'Gmail',
    auth: {
        type: 'OAuth2',
        user: config[USER].gmailUser,
        clientId: config[USER].clientId,
        clientSecret: config[USER].clientSecret,
        refreshToken: config[USER].refreshToken,
        accessToken: config[USER].accessToken,
    },
});

const generateNewMailOpts = ({ email, name, title }) => ({
    from: config[USER].gmailUser,
    to: email,
    subject: mail.genMailSubject(name, title),
    html: mail.genMailHtmlBody(name, title),
});

function sendMailAsync (customMailOptions, customTransporter) {
    return new Promise((resolve, reject) => {
        customTransporter.sendMail(customMailOptions, (error, response) => {
            if (error)
                reject(error);
            else
                resolve(response)
        });
    });
}

function timeout (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function pickMessageFromWorkQueue () {
    try {
        return await redisClient.rpoplpushAsync(WORK_QUEUE, PROCESSING_QUEUE);
    } catch (e) {
        debug(e)
    }
}

async function mailsSentToday () {
    const today = moment().startOf('day');
    return await redisClient.getAsync(`mails_sent_by_${ config[USER].gmailUser }_${ today }`);
}

function mailsSentTodayKeyName () {
    const today = moment().startOf('day');
    return `mails_sent_by_${ config[USER].gmailUser }_${ today }`;
}

async function reportMailSent () {
    const todayQueue = await redisClient.existsAsync(mailsSentTodayKeyName());
    if (!todayQueue) {
        await redisClient.setAsync(mailsSentTodayKeyName(), 0);
    }
    await redisClient.incrAsync(mailsSentTodayKeyName());
}

async function handleMail (mailData) {
    try {
        const r = await sendMailAsync(generateNewMailOpts(JSON.parse(mailData)), transporter);
        await reportMailSent()
        debug(r);
    } catch (e) {
        await redisClient.lpushAsync(WORK_QUEUE, mailData);
        debug(e);
        debug('Sleeping for 1min due to error...')
        await timeout(60000);
        return;
    }
}

async function removeMailFromProcessingQueue (mailData) {
    try {
        await redisClient.lremAsync(PROCESSING_QUEUE, 0, mailData);
    } catch (e) {
        await redisClient.lremAsync(PROCESSING_QUEUE, 0, mailData);
        debug(e);
    }
}

async function processMails () {
    debug('processing mail from queue');
    const mailData = await pickMessageFromWorkQueue()
    if (mailData && transporter.isIdle() && await mailsSentToday() < MAX_MAILS_PER_DAY) {
        await handleMail(mailData);
        await removeMailFromProcessingQueue(mailData);
    }
}

async function init () {
    debug('starting process')
    while (transporter.isIdle() && await redisClient.llenAsync(WORK_QUEUE) && await redisClient.getAsync(mailsSentTodayKeyName()) < MAX_MAILS_PER_DAY) {
        await processMails();
    }
    const qlen = await redisClient.llenAsync(WORK_QUEUE);
    debug('OUTSIDE LOOP %s', qlen)
    if (!qlen || await redisClient.getAsync(mailsSentTodayKeyName()) > MAX_MAILS_PER_DAY) {
        debug('All mails sent')
        debug('quiting redis...')
        transporter.close();
        redisClient.quit();
    }
}

transporter.on('idle', init);
