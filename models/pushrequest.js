// pushrequest.js
//
// data object representing a request to subscribe to a feed
//
// Copyright 2013, StatusNet Inc.
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

var _ = require("underscore"),
    async = require("async"),
    DatabankObject = require("databank").DatabankObject,
    RagtagIO = require("./ragtag-io");

var PushRequest = DatabankObject.subClass("pushrequest");

PushRequest.schema = {
    pkey: "verify_token",
    fields: ["mode",
             "topic",
             "created",
             "updated"]
};

PushRequest.beforeCreate = function(props, callback) {
    props.created = Date.now();
    props.updated = props.created;
    callback(null, props);
};

PushRequest.prototype.beforeUpdate = function(props, callback) {
    props.updated = Date.now();
    callback(null, props);
};

PushRequest.prototype.beforeSave = function(callback) {
    var sub = this;
    sub.updated = Date.now();
    if (!sub.created) {
        sub.created = sub.updated;
    }
    callback(null);
};

module.exports = PushRequest;
