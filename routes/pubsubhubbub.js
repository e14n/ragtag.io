// Client for pubsubhubbub-json
//
// Copyright 2012, 2013 E14N https://e14n.com/
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var async = require("async"),
    express = require("express"),
    bodyParser = express.bodyParser,
    _ = require("underscore"),
    config = require("./config"),
    httputils = require("./httputils").httputils,
    crypto = require("crypto"),
    PushRequest = require("../models/pushrequest"),
    Subscription = require("../models/subscription");

var subCallback = function(req, res) {

    var contentType = req.headers["content-type"];

    // Verify

    if (contentType === "application/x-www-form-urlencoded") {

        verifySubscription(req, res);

    } else if (contentType === "application/json") { // Content

        receiveContent(req, res);

    } else {
        res.writeHead(400, {"Content-Type": "text/plain"});
        res.end("Suck it loser");
    }
};

var verifySubscription = function(req, res) {

    var parse = bodyParser.parse["application/x-www-form-urlencoded"],
        showError = function(message) {
            res.writeHead(404, {"Content-Type": "text/plain"});
            res.end("Suck it loser");
        },
        params,
        verify_token;

    async.waterfall([
        function(callback) {
            parse(req, {}, callback);
        },
        function(callback) {
            params = req.body;
            verify_token = params["hub.verify_token"];

            PushRequest.get(verify_token, callback);
        },
        function(pushreq, callback) {
            if (params["hub.mode"] == pushreq.mode &&
                params["hub.topic"] == pushreq.topic) {
                callback(null);
            } else {
                callback(new Error("Mismatched PuSH request"));
            }
        }
    ], function(err) {
        if (err) {
            res.writeHead(404, {"Content-Type": "text/plain"});
            res.end("Suck it loser");
        } else {
            res.writeHead(200, {"Content-Type": "text/plain"});
            res.end(params["hub.challenge"]);
        }
    });
};

var receiveContent = function(req, res) {

    async.waterfall([
        function(callback) {
            parseJSON(req, callback);
        },
        function(callback) {

            var i, notice, topic, sub, sig;

            if (!_(req.body).has("items") || 
                !_(req.body.items).isArray() || 
                req.body.items.length === 0)
            {
                callback(new Error("Invalid payload"), null);
                return;
            }

            topic = req.body.items[0].topic;

            if (!_.every(req.body.items, function(item) { return item.topic == topic; })) {
                callback(new Error("Invalid payload"), null);
                return;
            }

            Subscription.get(topic, callback);
        },
        function(sub, callback) {

            var sig = req.headers["x-hub-signature"];

            if (!sig || sig !== hmacSig(req.rawBody, sub.secret)) {
                callback(new Error("Bad signature"));
                return;
            }
        }
    ], function(err) {
        if (err) {
            res.writeHead(404, {"Content-Type": "text/plain"});
            res.end("Suck it loser");
        } else {
            _.each(req.body.items, function(item) {
                deliverPayload(item.payload);
            });
        }
    });
};

// Snagged from express.bodyParser; grab the raw body so we can check the sig

var parseJSON = function(req, fn) {
    var buf = "";
    req.setEncoding("utf8");
    req.on("data", function(chunk) { 
        buf += chunk; 
    });
    req.on("end", function(){
        req.rawBody = buf;
        try {
            req.body = buf.length ? JSON.parse(buf) : {};
            fn();
        } catch (err) {
            fn(err);
        }
    });
};

var hmacSig = function(message, secret) {
    var hmac = crypto.createHmac("sha1", secret);
    hmac.update(message);
    return hmac.digest("hex");
};

var deliverPayload = function(payload) {
    // NOOP
};
