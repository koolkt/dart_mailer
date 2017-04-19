var parse = require('csv-parse');
var nodemailer = require("nodemailer");
var fs = require('fs');
var config = require('./config/config');
var ProgressBar = require('progress');
var redis = require("redis"),
    client = redis.createClient();

const bar = new ProgressBar('  downloading [:bar] :percent :etas', { total: 1 });

let transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        type: 'OAuth2',
        user: config.GMAIL_USER,
        clientId: config.CLIENT_ID,
        clientSecret: config.CLIENT_SECRET,
        refreshToken: config.REFRESH_TOKEN,
        accessToken: config.ACCESS_TOKEN
    }
});

const generate_new_mail_opts = ({ email, name, title }) => ({
    from: config.GMAIL_USER,
    to: email,
    subject: config.genMailSubject(name, title),
    text: config.genMailTxtBody(name, title),
    attachments: config.attachments
});        

function send_mail(customMailOptions, customTransporter) {
    customTransporter.sendMail(customMailOptions, (error, response) => {
        if (error) {
            console.log(error)
            client.rpush("mailer_errors_v2_test", JSON.stringify(error));
        } else {
            client.rpush("mailer_responses_v2_test", JSON.stringify(response));
        }
        bar.tick();
        smtpTransport.close();
    });
}

const csv_file = fs.readFileSync(config.CSV_FILE, 'utf-8');

parse(csv_file, {columns: true, delimiter: ','}, (err, output) => {
    output.slice(0,1000).forEach((person) => {
        send_mail(generate_new_mail_opts(person), transporter)
    });
});

const finish = () => {
    if (bar.complete) {
        console.log('\ncomplete\n');
        client.quit()
        return
    }
    setTimeout(finish, 2000)
}

finish()
