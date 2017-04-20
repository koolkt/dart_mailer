const Promise = require('bluebird');
const nodemailer = require('nodemailer');
const redis = require('redis');
const moment = require('moment');
const debug = require('debug')('debug:mail_client');
const config = require('../config/config');
const mail = require('../config/config_mail');

const WORK_QUEUE = `marie_work_queue_${ config.GMAIL_USER }`;
const PROCESSING_QUEUE = `marie_processing_queue_${ process.env.CLIENT_NAME || config.GMAIL_USER }`;
const TODAY = moment().startOf('day');
const MAILS_SENT_TODAY_QUEUE = `mails_sent_by_${ config.GMAIL_USER }_${ TODAY }`;
const MAX_MAILS_PER_DAY = 1500;
Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);
const redisClient = redis.createClient();
const transporter = nodemailer.createTransport({
    pool: true,
    service: 'Gmail',
    auth: {
        type: 'OAuth2',
        user: config.GMAIL_USER,
        clientId: config.CLIENT_ID,
        clientSecret: config.CLIENT_SECRET,
        refreshToken: config.REFRESH_TOKEN,
        accessToken: config.ACCESS_TOKEN,
    },
});

const generateNewMailOpts = ({ email, name, title }) => ({
    from: config.GMAIL_USER,
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

async function processMails () {
    debug('processing mail from queue');
    const workQueLength = await redisClient.llenAsync(WORK_QUEUE)
    if (!workQueLength) {
        transporter.close();
        return;
    }
    let mailData;
    let r;
    try {
        mailData = await redisClient.rpoplpushAsync(WORK_QUEUE, PROCESSING_QUEUE);
    } catch (e) {
        debug(e)
        return;
    }
    const mailsSentToday = await redisClient.getAsync(MAILS_SENT_TODAY_QUEUE);
    if (transporter.isIdle() && mailsSentToday < MAX_MAILS_PER_DAY) {
        try {
            r = await sendMailAsync(generateNewMailOpts(JSON.parse(mailData)), transporter);
            debug(r);
        } catch (e) {
            debug(e);
            await timeout(60000);
            return;
        }
        try {
            await redisClient.lpopAsync(PROCESSING_QUEUE);
            await redisClient.incrAsync(MAILS_SENT_TODAY_QUEUE);
        } catch (e) {
            await redisClient.lpopAsync(PROCESSING_QUEUE);
            await redisClient.incrAsync(MAILS_SENT_TODAY_QUEUE);
            debug(e);
        }
    }
}


async function init () {
    debug('starting process')
    const todayQueue = await redisClient.existsAsync(MAILS_SENT_TODAY_QUEUE);
    if (!todayQueue) {
        await redisClient.setAsync(MAILS_SENT_TODAY_QUEUE, 0);
    }
    while (transporter.isIdle() && await redisClient.llenAsync(WORK_QUEUE) && await redisClient.getAsync(MAILS_SENT_TODAY_QUEUE) < MAX_MAILS_PER_DAY) {
        await timeout(500);
        await processMails();
    }
    const qlen = await redisClient.llenAsync(WORK_QUEUE);
    debug('OUTSIDE LOOP %s', qlen)
    if (!qlen) {
        debug('quiting redis...')
        redisClient.quit();
    }
}

transporter.on('idle', init);
