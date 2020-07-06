import TurndownService from 'turndown';
const turndownService = new TurndownService();

export const functional = {
    /**
     * The identity function
     * @see handleMessages()
     * @param a Anything
     * @return @p a
     */
    id(a) { return a; },

    /**
     * Maybe monad composition for unary functions
     * If @p f or @p g or f(x) return a falsy value, it will propagate through
     * @param f Outer (later, 2nd) function
     * @param g Inner (earlier, 1st) function
     * @return New function that composes @p f and @p g, unless @p f, @p g, or the intermediary result is falsy (it returns undefined, i.e. Nothing)
     */
    maybeCompose( f, g ) {
        return x => {
            if( !f || !g ) return undefined;

            const y = g( x );
            if( !y ) return undefined;
            else return f( x );
        };
    },


};

export const helpers = {
    /**
     * A transformer that converts received HTML into markdown.
     * @param m Message object
     * @return Message object with markdown body
     */
    reduceHtml(m) {
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
    },

    /**
     * Filter that checks message visibility.
     * Uses global config room and global.
     * @see config
     * @param m Message object
     * @return The message object if it is visible, undefined otherwise
     */
    roomCheck( m, config ) {
        return ( m.channel !== config.room && !config.global ) ? undefined : m;
    },
};
