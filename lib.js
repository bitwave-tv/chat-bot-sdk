"use strict";
import api from '@bitwave/chat-client';
import $log from './log.js';

import TurndownService from 'turndown';
const turndownService = new TurndownService();

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
 * The identity function
 * @see handleMessages()
 * @param a Anything
 * @return @p a
 */
const id = a => a;

/**
 * Composition for unary functions
 * @param f Outer (later, 2nd) function
 * @param g Inner (earlier, 1st) function
 * @return New function x => f(g(x))
 */
const compose = ( f, g ) => {
    return x => {
        return f( g( x ) );
    };
};

/**
 * Maybe monad composition for unary functions
 * If @p f or @p g or f(x) return a falsy value, it will propagate through
 * @param f Outer (later, 2nd) function
 * @param g Inner (earlier, 1st) function
 * @return New function that composes @p f and @p g, unless @p f, @p g, or the intermediary result is falsy (it returns undefined, i.e. Nothing)
 */
const maybeCompose = ( f, g ) => {
    return x => {
        if( !f || !g ) return undefined;

        const y = g( x );
        if( !y ) return undefined;
        else return f( x );
    };
};

/**
 * Handles received messages.
 * It first applies all transformers to the message, then all filters.
 * If it passes them all, it gets sent to the consumer.
 * @param self this belonging to the exported object
 * @param ms An array of message objects
 */
const handleMessages = ( self, ms ) => {
    const transform = self.transformers.reduce( (x, y) => maybeCompose(x, y), id );
    const filter    = self.     filters.reduce( (x, y) => maybeCompose(x, y), id );
    for( const m of ms ) {
        const mp = transform( m );
        if( mp ) {
            if( filter( mp ) ) {
                self.consumer( mp );
            }
        }
    }
};

/**
 * A transformer that converts received HTML into markdown.
 * @param m Message object
 * @return Message object with markdown body
 */
const reduceHtml = m => {
    const mp = m;

    const unescapeHtml = unsafe => {
        return unsafe
            .replace( /&amp;/g,  `&` )
            .replace( /&lt;/g,   `<` )
            .replace( /&gt;/g,   `>` )
            .replace( /&quot;/g, `"` )
            .replace( /&#39;/g,  `'` );
    };

    // <p></p>
    mp.message = mp.message.replace( /<\/?p[\w =#"':\/\\.\-?]*>/gi, "" );

    // <a>gets left</a>
    // Custom links are text in <a>, and then the link in <kbd>
    mp.message = mp.message.replace( /<\/?a[\w -=#"':\/\\.\-?]*>/gi, "" );
    mp.message = mp.message.replace( "<kbd>", "" );
    mp.message = mp.message.replace( "</kbd>", "" );

    // <img> to :emotes:
    mp.message = mp.message.replace( /<img[\w -=#"':\/\\.\-?]*>/gi, m => {
        // (((, ))), :), :( are rendered differently
        // (They dont even show up in the emote list)
        //
        // It wouldn't be so bad if the two echos were 'echol' and 'echor', but
        //  one echo is flipped with CSS.
        if( m.includes('alt="echo"') ) {
            return m.includes('scaleX(-1)') ? "(((" : ")))";
        }
        return m.match( /alt="([\w:()]+)"/ )[1];
    });

    mp.message = turndownService.turndown( mp.message );

    return mp;
};

/**
 * Filter that checks message visibility.
 * Uses global config room and global.
 * @see config
 * @param m Message object
 * @return The message object if it is visible, undefined otherwise
 */
const roomCheck = ( m ) => {
    return ( m.channel !== config.room && !config.global ) ? undefined : m;
};

/**
 * Settings for the command parser
 */
const commandParserSettings = {
    prefix: '!', /**< Command prefix */
    commands: new Map(), /**< Mapping of command name -> binary function ( message, args ) */
};

/**
 * Filter that checks whether the message is a command
 * @param m Message object
 * @return @p m if it is a command, false otherwise.
 */
const isCommand = m => {
    return m.message.startsWith( commandParserSettings.prefix ) ? m : false;
};

/**
 * The command parser. The default message consumer.
 * Is configured in #commandParserSettings
 * @see commandParserSettings
 * @param m Message object
 */
const commandParser = m => {
    // removes prefix
    m.message = m.message.replace( commandParserSettings.prefix, "" );
    const args = m.message.split(' ');

    const command = commandParserSettings.commands.get(args[0]);
    if( command ) {
        args.shift();
        command( m, args );
    } else {
        $log.info( `No command ${args[0]} found` );
    }
};

export default {

    get config() { return config; }, /**< Config object. Changes are live */
    set config(c) { config = c; },

    get commandParserSettings() { return commandParserSettings; }, /**< Settings for the command parser */
    set commandParserSettings(s) { commandParserSettings = s; },

    transformers: [ reduceHtml ], /**< An array of unary functions (Message -> Maybe Message). Called, in order, before filtering */
    filters: [ roomCheck, isCommand ], /**< An array of unary functions (Message -> Maybe Message). Order must not matter, must not change the object. Called after transformers */

    /**
     * Function called after transformers and filters.
     * By default, it prints to console and forwards to the command parser.
     * @param m Message object
     */
    consumer( m ) { console.log( m ); commandParser( m ); },

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
        api.sendMessage({
            message: msg,
            channel: this.config.room,
            global: this.config.global,
            showBadge: true,
        });
    },

    /**
     * Sends @p msg to channel @p channel, and then returns to the old channel
     * @see config
     */
    sendToChannel( msg, channel ) {
        const oldRoom = this.config.room;
        this.config.room = channel;
        this.send( msg );
        this.config.room = oldRoom;
    },

    async updateUsernames() { await api.updateUsernames(); },
    get channelViewers() { return api.channelViewers; },

};
