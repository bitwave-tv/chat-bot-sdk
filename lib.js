"use strict";
import api from '@bitwave/chat-client';

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
    // <p>
    //mp.message = m.message.substring( 3, m.message.length-5 );

    // <a>gets left</a>
    mp.message = mp.message.replace( /<\/?a[\w ="':\/\\.]*>/gi, "" );

    // <img> to :emotes:
    //mp.message = mp.message.replace( /<img[\w ="':\/\\.\-?]*>/gi, m => {
    //    return m.search( /https:\/\/[\/\w\.\-?]*/ );
    //});
    return mp;
};

const roomCheck = ( m ) => {
    return ( m.channel !== config.room && !config.global ) ? undefined : m;
};

export default {

    get config() { return config; },
    set config(c) { config = c; },

    transformers: [ reduceHtml ],
    filters: [ roomCheck ],

    consumer( m ) { console.log( m ); },

    async init() {
        api.rcvMessageBulk = ms => handleMessages( this, ms );
        await api.init( this.config.room, this.config.credentials );
    }

};
