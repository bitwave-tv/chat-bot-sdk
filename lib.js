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

    const unescapeHtml = unsafe => {
        return unsafe
            .replace( /&amp;/g,  `&` )
            .replace( /&lt;/g,   `<` )
            .replace( /&gt;/g,   `>` )
            .replace( /&quot;/g, `"` )
            .replace( /&#39;/g,  `'` );
    };

    // <blockquote> -> green text
    mp.message = mp.message.replace(  /<\/?blockquote>/g, "" );
    mp.message = unescapeHtml( mp.message );

    // <span> -> 8chan green text
    mp.message = mp.message.replace(  /<\/?span[\w =#"':\/\\.\-?]*>/gi, "" );

    // <p></p>
    mp.message = mp.message.replace( /<\/?p[\w =#"':\/\\.\-?]*>/gi, "" );

    // TODO: investigate if custom links can appear
    // <a>gets left</a>
    mp.message = mp.message.replace( /<\/?a[\w =#"':\/\\.]*>/gi, "" );

    mp.message = mp.message.replace( "<h1>", "# " );
    mp.message = mp.message.replace( "<h2>", "## " );
    mp.message = mp.message.replace( "<h3>", "### " );
    mp.message = mp.message.replace( "<h4>", "#### " );
    mp.message = mp.message.replace( "<h5>", "##### " );

    mp.message = mp.message.replace( /<\/h[1-5]/, "" );


    // <img> to :emotes:
    mp.message = mp.message.replace( /<img[\w =#"':\/\\.\-?]*>/gi, m => {
        return m.match( /:\w+:/ )[0];
    });
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
