require('dotenv').config()
var util = require('util');
var mysql = require('mysql');
var Client = require('node-xmpp-client')
const config = require('./config').settings;

var client = new Client(config.client)
// client.socket.setTimeout(0);
// client.socket.setKeepAlive(true, 10000);



/**
 * Request the roster from the Google identity query service
 * http://code.google.com/apis/talk/jep_extensions/roster_attributes.html#3
 */
function request_google_roster() {
    var roster_elem = new Client.Stanza('iq', {
            from: client.jid,
            type: 'get',
            id: 'google-roster'
        })
        .c('query', {
            xmlns: 'jabber:iq:roster',
            'xmlns:gr': 'google:roster',
            'gr:ext': '2'
        });
    client.send(roster_elem);
}

/**
 * Set the status message of the bot to the supplied string
 * @param {String} status_message
 */
function set_status_message(status_message) {
    client.send(new Client.Stanza('presence', {})
        .c('show').t('chat').up()
        .c('status').t(status_message)
    )
}

/**
 * Accept any subscription request stanza that is sent over the wire
 * @param {Object} stanza
 */
function accept_subscription_requests(stanza) {
    if (stanza.is('presence') &&
        stanza.attrs.type === 'subscribe') {
        var subscribe_elem = new Client.Stanza('presence', {
            to: stanza.attrs.from,
            type: 'subscribed'
        });
        client.send(subscribe_elem);
        console.log("accept subscription from: ", stanza.attrs.from);
    }
}

/**
 * Send a message to the supplied JID
 * @param {String} to_jid
 * @param {String} message_body
 */
function send_message(to_jid, message_body) {
    var elem = new Client.Stanza('message', {
            to: to_jid,
            type: 'chat'
        })
        .c('body').t(message_body);
    client.send(elem);
    util.log('[message] SENT: ' + elem.up().toString());
}

    /**
     * A wrapper for send message to wrap the supplied command in help
     * text
     */
    function send_unknown_command_message(request) {
        send_message(request.stanza.attrs.from, 'Unknown command: "' + request.command + '". Type "help" for more information.');
    }


client.on('online', function() {
    console.log('online')
    set_status_message(config.status_message);

    // send whitespace to keep the connection alive and prevent timeouts
    setInterval(function() {
        client.send(' ');
    }, 30000);
});

client.on('stanza', function(stanza) {
    if (stanza.is('message') &&
        // Important: never reply to errors!
        (stanza.attrs.type !== 'error')) {
        // Swap addresses...
        stanza.attrs.to = stanza.attrs.from
        delete stanza.attrs.from
        // and send back
        console.log('Sending response: ' + stanza.root().toString())
        client.send(stanza)
    }
    if (stanza.is('presence') &&
        stanza.attrs.type === 'subscribe') {
        var subscribe_elem = new Client.Stanza('presence', {
            to: stanza.attrs.from,
            type: 'subscribed'
        });
        client.send(subscribe_elem);
        console.log("accept subscription from: ", stanza.attrs.from);
    }
})

if (config.allow_auto_subscribe) {
    // auto add friends from JID 
    client.addListener('online', request_google_roster);
    client.addListener('stanza', accept_subscription_requests);
}

client.on('error', function(stanza) {
    util.log('[error] ' + stanza.toString());
});
