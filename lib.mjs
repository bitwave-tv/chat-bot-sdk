"use strict";
import  _api from '@bitwave/chat-client';
const api = _api.default;
import $log from './log.mjs';
import { functional, helpers } from './helpers.mjs';

/**
 * Global config. Gets used for sending/receiving messages.
 * Intended to be setup before a call to #init().
 */
let config = {
    room: 'global', /**< The home room for the bot */
    global: false, /**< Global chat setting. Messages may get filtered according to this */
    credentials: null, /**< Some sort of credentials. Null for troll token, string for JWT token */
};

/**
 * Handles received messages.
 * It first applies all transformers to the message, then all filters.
 * If it passes them all, it gets sent to the consumer.
 * @param self this belonging to the exported object
 * @param ms An array of message objects
 */
const handleMessages = ( self, ms ) => {
    const transform = self.transformers.reduce( (x, y) => functional.maybeCompose(x, y), functional.id );
    const filter    = self.     filters.reduce( (x, y) => functional.maybeCompose(x, y), functional.id );
    for( const m of ms ) {
        let mp = helpers.reduceHtml( m );
        if( filter( mp ) ) {
            mp = transform( mp );
            if( mp ) {
                const result = self.consumer( mp );
                if( typeof result === 'string' ) {
                    self.send( result );
                } else if( result && result[0] !== undefined && result[1] !== undefined ) {
                    self.sendToChannel( result[0], result[1] );
                }
            }
        }
    }
};

const roomCheck = m => helpers.roomCheck( m, config );

/**
 * Sends @p msg to current channel
 * @param msg String
 */
const send = msg => {
    $log.info( `Sent message: "${msg}"` );
    api.sendMessage({
        message: msg,
        channel: config.room,
        global: config.global,
        showBadge: true,
    });
};

/**
 * Sends @p msg to channel @p channel, and then returns to the old channel
 * @see config
 */
const sendToChannel = ( msg, channel ) => {
    const oldRoom = config.room;
    config.room = channel;
    send( msg );
    config.room = oldRoom;
};

import commandParser from './commandParser.mjs';
commandParser._config_getter = () => config;

export default {

    get config() { return config; }, /**< Config object. Changes are live */
    set config(c) { config = c; },

    get commandParserSettings() { return commandParser.commandParserSettings; }, /**< Settings for the command parser */
    set commandParserSettings(s) { commandParser.commandParserSettings = s; },

    transformers: [ helpers.reduceHtml ], /**< An array of unary functions (Message -> Maybe Message). Called, in order, before filtering */
    filters: [ roomCheck, commandParser.isCommand ], /**< An array of unary functions (Message -> Maybe Message). Order must not matter, must not change the object. Called after transformers */

    /**
     * Function called after transformers and filters.
     * By default, it prints to console and forwards to the command parser.
     * @param m Message object
     */
    consumer( m ) {
        console.log( m );
        const result = commandParser.pipedCommandParser( m );
        return result;
    },

    /**
     * Starts connection to server with configuration from #config
     * @see config
     */
    async init() {
        api.rcvMessageBulk = ms => handleMessages( this, ms );
        await api.init( this.config.room, this.config.credentials );
    },

    /**
     * Sends @p msg to current channel
     * @param msg String
     */
    send( msg ) {
        send( msg );
    },

    /**
     * Sends @p msg to channel @p channel, and then returns to the old channel
     * @see config
     */
    sendToChannel( msg, channel ) {
        sendToChannel( msg, channel );
    },

    async updateUsernames() { await api.updateUsernames(); },
    get channelViewers() { return api.channelViewers; },

};
