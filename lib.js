"use strict";
import api from '@bitwave/chat-client';
import $log from './log.js';

import TurndownService from 'turndown';
const turndownService = new TurndownService();

let config = {
    room: 'global',
    global: false,
    credentials: null,
};

const id = a => a;

const compose = ( f, g ) => {
    return x => {
        return f( g( x ) );
    };
};

// maybe monad composition, basically
const maybeCompose = ( f, g ) => {
    return x => {
        if( !f || !g ) return undefined;

        const y = g( x );
        if( !y ) return undefined;
        else return f( x );
    };
};

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

const roomCheck = ( m ) => {
    return ( m.channel !== config.room && !config.global ) ? undefined : m;
};

const commandParserSettings = {
    prefix: '!',
    commands: new Map(),
};
const isCommand = m => {
    return m.message.startsWith( commandParserSettings.prefix ) ? m : false;
};
const commandParser = m => {
    // removes prefix
    m.message = m.message.replace( commandParserSettings.prefix, "" );
    const args = m.message.split(' ');

    const command = commandParserSettings.commands.get(args[0]);
    if( command ) {
        command( m, args.splice(1, 1) );
    } else {
        $log.info( `No command ${args[0]} found` );
    }
};

export default {

    get config() { return config; },
    set config(c) { config = c; },

    get commandParserSettings() { return commandParserSettings; },
    set commandParserSettings(s) { commandParserSettings = s; },

    transformers: [ reduceHtml ],
    filters: [ roomCheck, isCommand ],

    consumer( m ) { console.log( m ); commandParser( m ); },

    async init() {
        api.rcvMessageBulk = ms => handleMessages( this, ms );
        await api.init( this.config.room, this.config.credentials );
    },

    send( msg ) {
        api.sendMessage({
            message: msg,
            channel: this.config.room,
            global: this.config.global,
            showBadge: true,
        });
    },

    sendToChannel( msg, channel ) {
        const oldRoom = this.config.room;
        this.config.room = channel;
        this.send( msg );
        this.config.room = oldRoom;
    }

};
