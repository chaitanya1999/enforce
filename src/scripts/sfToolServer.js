const process = require('process');
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const fs = require('fs');
const AuthTest = require('./AuthTest');
const { WebSocketServer, WebSocket } = require('ws');
const https = require('https');
const codeToFetch = require('./codeToFetch');
const QueryTool = require('./QueryTool');
const ObjectSchemaFetcher = require('./ObjectSchemaFetcher');

const httpServer = new https.createServer({
    cert: fs.readFileSync('../ssl/cert.pem'),
    key: fs.readFileSync('../ssl/key.pem')
});

const server = new WebSocketServer({ server: httpServer });

var queryTool = new QueryTool();
var objectSchemaFetcher = new ObjectSchemaFetcher();
var auth = new AuthTest();

server.on('connection', function connection(ws) {
    console.log('connected');
    ws.on('message', async function message(data) {
        data = JSON.parse(data);
        console.log('MESSAGE => ' , data);
        if(data.tag == 'getCredentials'){
            sendMessage(ws, data, codeToFetch.CREDENTIALS);
        } else if(data.tag == 'authenticate'){
            let credsName = data.args.name;

            let result = await auth.main(credsName);
            sendMessage(ws, data, result);
        } else if(data.tag == 'executeSOQL'){
            let soqlQuery = data.args.query;
            let orgName = data.args.orgName;
            let fetchDeleted = data.args.fetchDeleted;

            let result = await queryTool.executeSOQL(orgName , soqlQuery , fetchDeleted);
            sendMessage(ws, data, result);
        } else if(data.tag == 'getObjectSchema'){
            let objName = data.args.objectName;
            let orgName = data.args.orgName;

            let result = await objectSchemaFetcher.fetchSchema(orgName, objName);
            sendMessage(ws, data, result);
        }
    });
    
    sendMessage(ws, {}, 'Connected');
});

server.on('error' , e => {
    console.log(' server ws error => ' , e);
});

server.on('wsClientError' , e => {
    console.log(' server wsClientError => ' , e);
});

server.on('close' , e => {
    console.log(' server close => ' , e);
});


sendMessage = function(ws, request, response){
    ws.send(JSON.stringify({request, response}));
}


httpServer.listen(8796 ,'127.0.0.1', x => {
    console.log('Server Started');
});

//test the ws connection
let wsTest = new WebSocket('wss://localhost:8796');
wsTest.on('open', function open() {
    console.log('Test Websocket => Connected')
    wsTest.send(`{"dummyMessage":"Test Websocket Message"}`);
    wsTest.close();
});




/*
run server => 
    NODE_TLS_REJECT_UNAUTHORIZED='0' node app.js


openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 100 -nodes

openssl x509 -outform der -in cert.pem -out cert.crt

openssl rsa -outform der -in key.pem -out key.key

*/
