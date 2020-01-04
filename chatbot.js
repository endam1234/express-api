
var express = require("express");
var path = require("path");
var bodyParser = require("body-parser");
//const serviceAccount = require("./faqbot-wfrawf-bcf6eb797f11.json")
//var mongodb = require("mongodb");
//var ObjectID = mongodb.ObjectID;
const fs = require('fs'); //for reading files etc.
const readline = require('readline');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
const TOKEN_PATH = 'token.json';
const TESTS_COLLECTION = "tests";

//const google = require('googleapis');


var http = require("http");
setInterval(function() {
    http.get("http://faqbot-chatbot-api.herokuapp.com");
}, 300000);

var app = express();
/*app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json()); */

app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());

// Connect to the database before starting the application server -- only necessary if db access allowed
/*mongodb.MongoClient.connect(dbUri, function (err, client) {
    if (err) {
        console.log(err);
        process.exit(1);
    }
*/
    // Save database object from the callback for reuse - rsa name of db
    //db = client.db('rsa');
    //console.log("Database connection ready");

    // Initialize the app - initialising chatbot on local port
    var server = app.listen(process.env.PORT || 8080, function () {
        var port = server.address().port;
        console.log("App now running on port", port);
    });
  //}
//);

function authorize(credentials, callback, message, res) {
    console.log('authorize started');
    const { client_secret, client_id, redirect_uris } = credentials.web;
    //const { client_secret, client_id, redirect_uris } = credentials.installed; //credentials.json
    console.log({ client_secret, client_id, redirect_uris });
    var oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]); //google api Credentials

    // Check if we have previously stored a token - unique information on a new user who runs this server/chatbot
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback, message, res);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client, message, res);
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * oAuth2Client The OAuth2 client to get token for.
 * callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback, message, res) {
    console.log('getnewtoken started');
    const authUrl = oAuth2Client.generateAuthUrl({ //required to sent gmail
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({ //creates an interface instance
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            return callback(oAuth2Client, message, res);
        });
    });
}

function makeBody(to, from, subject, message) {
    console.log('make body started');
    var str = ["Content-Type: text/plain; charset=\"UTF-8\"\n",
        "MIME-Version: 1.0\n",
        "Content-Transfer-Encoding: 7bit\n",
        "to: ", to, "\n",
        "from: ", from, "\n",
        "subject: ", subject, "\n\n",
        message
    ].join('');

    var encodedMail = new Buffer.from(str).toString("base64").replace(/\+/g, '-').replace(/\//g, '_');
    return encodedMail;
}

function sendFeedback(auth, message, res) { //look into this - chatbot platform settings
    console.log('send feedback started');
    console.log(message);
    const gmail = google.gmail({ version: 'v1', auth });
    //console.log(gmail);
    var raw = makeBody('grebelskimario@gmail.com', 'endamckenna1998@gmail.com', 'Feedback', message); //calls makeBody(), message defined from chatbot, feedback is the subject title
    //above line: must send from endamck.... , as this is the authorised email
    //console.log(raw);
    //console.log(auth);
    gmail.users.messages.send({
        auth: auth,
        userId: 'me',
        resource: {
            raw: raw
        }
    }, function (err, response) {
      console.log(err);
      //console.log(response);
        if (err) {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({
                fulfillmentText: 'Feedback failed!'
            }));
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({
                fullfillmentText: 'Feedback recorded!'
            }));
        }
    });
}

// CONTACTS API ROUTES BELOW - when using fb messenger



// Generic error handler used by all endpoints.
function handleError(res, reason, message, code) {
    console.log("ERROR: " + reason);
    res.status(code || 500).json({ "error": message });
}

app.post("/echo", bodyParser.urlencoded({ extended:    true     }), function(req, res) {
  var speech =
    req.body.queryResult &&
    req.body.queryResult.parameters &&
    req.body.queryResult.parameters.message
      ? req.body.queryResult.parameters.message
      : "Seems like some problem. Speak again.";

  var speechResponse = {
    google: {
      expectUserResponse: true,
      richResponse: {
        items: [
          {
            simpleResponse: {
              textToSpeech: speech
            }
          }
        ]
      }
    }
  };

  return res.json({
    payload: speechResponse,
    //data: speechResponse,
    fulfillmentText: speech,
    speech: speech,
    displayText: speech,
    source: "webhook-echo-sample"
  });
});
/*
app.post("/api/test", function (req, res) {
    switch (req.body.queryResult.action) {
        case 'retrieveDate':
            if (req.body.queryResult.parameters.number) { //number is param in chatbot
                console.log('date case started');
                db.collection(TESTS_COLLECTION).findOne({ driverNumber: req.body.queryResult.parameters.number.toString() }, function (err, doc) {
                    if (err) {
                        res.setHeader('Content-Type', 'application/json');
                        res.send(JSON.stringify({
                            "fulfillment_text": 'Failed'
                        }));
                    } else {
                        if (doc) {
                            var reply = doc.date; //db column 'date'
                            res.setHeader('Content-Type', 'application/json');
                            res.send(JSON.stringify({
                                "fulfillment_text": 'You passed your test on: ' + reply
                            }));
                        } else {
                            res.setHeader('Content-Type', 'application/json');
                            res.send(JSON.stringify({
                                "fulfillment_text": 'Sorry we could not find a date, please try again'
                            }));
                        }
                    }
                });
            }
            break;
        case 'More_Information_Send_Email':
            console.log('email case started');
            if (req.body.queryResult.parameters.message) { //message is chatbot param, checks if it has been filled
                console.log('if email started');
                fs.readFile('credentials.json', (err, content) => { //gmail credentials
                    if (err) return console.log('Error loading client secret file:', err);
                    // Authorize a client with credentials, then call the Gmail API.
                    console.log('authorize called');
                    authorize(JSON.parse(content), sendFeedback, req.body.queryResult.parameters.message, res); //calls sendFeedback function with the gmail credentials
                });
            }
            break;
        default:
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({
                "fulfillment_text": 'Something went wrong, please try again'
            }));
    }
}); */
//sendMessage/:message POST
/*app.post("/api/email:message", bodyParser.urlencoded({ extended:    true     }), function (req, res) {
  console.log('email case started');
  if (req.body.queryResult.parameters.message) { //message is chatbot param, checks if it has been filled
      console.log('if email started');
      fs.readFile('credentials.json', (err, content) => { //gmail credentials
          if (err) return console.log('Error loading client secret file:', err);
          // Authorize a client with credentials, then call the Gmail API.
          console.log('authorize called');
          authorize(JSON.parse(content), sendFeedback, req.body.queryResult.parameters.message, res); //calls sendFeedback function with the gmail credentials
      });
  }
});*/

app.post("/api/email", bodyParser.urlencoded({ extended:    true     }), function (req, res) {
  console.log('email case started');
  //var message = "jjj";
  //if(message) {
  if (req.body.queryResult.parameters.message) { //message is chatbot param, checks if it has been filled
      console.log('if email started');
      fs.readFile('credentials.json', (err, content) => { //gmail credentials
          if (err) return console.log('Error loading client secret file:', err);
          // Authorize a client with credentials, then call the Gmail API.
          console.log('authorize called');
          //authorize(JSON.parse(content), sendFeedback, message, res);
          authorize(JSON.parse(content), sendFeedback, req.body.queryResult.parameters.message, res); //calls sendFeedback function with the gmail credentials
      });
  }

});
