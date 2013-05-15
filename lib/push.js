// Driving the PubSubHubbub subscription process
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

var crypto = require("crypto"),
    async = require("async"),
    _ = require("underscore"),
    request = require("request"),
    PumpLive = require("../models/pumplive"),
    PushRequest = require("../models/pushrequest"),
    Subscription = require("../models/subscription");

var subscribe = function(topic, callback) {
    
    async.waterfall([
        function(callback) {
            discoverHub(topic, callback);
        },
        function(hub, callback) {
            subscribeTopic(topic, hub, callback);
        }
    ], callback);
};

var discoverHub = function(topic, callback) {

    discoverByHead(topic, function(err, hub) {
        if (err) {
            discoverByContent(topic, callback);
        } else {
            callback(null, hub);
        }
    });
};

var discoverByContent = function(topic, callback) {

    async.waterfall([
        function(callback) {
            request(topic, callback);
        },
        function(resp, body, callback) {
            var doc;
            if (resp.headers["content-type"] !== "application/json") {
                callback(new Error("Not JSON"), null);
                return;
            }
            try {
                doc = JSON.parse(body);
            } catch (err) {
                callback(err, null);
                return;
            }
            if (!doc.hubs || doc.hubs.length === 0) {
                callback(new Error("No hubs declared in document"), null);
                return;
            }
            callback(null, doc.hubs[0]);
        }
    ], callback);
};

var discoverByHead = function(topic, callback) {

    var getLinks = function(linkHeader) {

        var i, j, link, part, parts, href, hrefPart, links, ops, linkStr, linkStrs, key, value;

        linkStrs = linkHeader.split(",");

        links = [];

        for (i in linkStrs) {

            linkStr = linkStrs[i].trim();
            parts = linkStr.split(";");
            hrefPart = parts.shift();
            href = hrefPart.match(/<(.*?)>/);

            if (!href) {
                continue;
            }

            link = {href: href[1]};

            for (j in parts) {
                part = parts[j].trim();
                ops = part.split("=");
                key = ops[0].trim();
                value = ops[1].trim();
                value = value.replace(/^[\"\"]|[\"\"]$/g, "");
                link[key] = value;
            }

            links.push(link);
        }

        return links;
    };

    async.waterfall([
        function(callback) {
            request.head(topic, callback);
        },
        function(res, body, callback) {
            var hubs = [], links, i;
            links = getLinks(res.headers.link);
            hubs = _.filter(links, function(link) { return link.rel == "hub"; });
            if (hubs.length === 0) {
                callback(new Error("No hub in links"), null);
            } else {
                callback(null, hubs[0].href);
            }
        }
    ], callback);
};

var subscribeTopic = function(topic, hub, callback) {

    var verifyToken, secret, params,
        urlsafe = function(buf) {
            var str = buf.toString("base64");
            str = str.replace(/\+/g, "-");
            str = str.replace(/\//g, "_");
            str = str.replace(/\=/g, "");
            return str;
        },
        newVerifyToken = function() {
            return urlsafe(crypto.randomBytes(16));
        },
        newSecret = function() {
            return urlsafe(crypto.randomBytes(64));
        };
    
    verifyToken = newVerifyToken();
    secret = newSecret();

    async.waterfall([
        function(callback) {
            PushRequest.create({verify_token: verifyToken,
                                mode: "subscribe",
                                topic: topic},
                               callback);
        },
        function(pushreq, callback) {
            var options = {
                uri: hub,
                form: {"hub.callback": PumpLive.url("/callback"),
                       "hub.mode": "subscribe",
                       "hub.topic": topic,
                       "hub.verify": "sync",
                       "hub.verify_token": verifyToken,
                       "hub.secret": secret}
            };
            request.post(options, callback);
        },
        function(res, body, callback) {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                callback(new Error("Failed subscription."), null);
                return;
            }
            Subscription.create({topic: topic, secret: secret}, callback);
        }
    ], callback);
};

module.exports.subscribe = subscribe;
