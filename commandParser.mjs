"use strict";
import $log from './log.mjs';

/**
 * Settings for the command parser
 */
const commandParserSettings = {
    prefix: ['!'], /**< Command prefix */
    commands: new Map(), /**< Mapping of command name -> {n-ary function ( message, ...args ), [prefix, global]} */
    enablePipes: true, /**< Enable unix-like pipes for commands */
};

export default {

    get commandParserSettings() { return commandParserSettings; },
    set commandParserSettings(x) { commandParserSettings = x; },

    _config_getter: null,

    get config() { return this._config_getter(); },

    /**
     * Filter that checks whether the message is a command.
     * @param m Message object
     * @return @p m if it is a command, false otherwise.
     */
    isCommand(m) {
        const defaultPrefixes = commandParserSettings.prefix.some( p => m.message.startsWith( p ) );
        if( defaultPrefixes ) return m;

        let customPrefix = false;
        for( const c of commandParserSettings.commands.values() ) {
            if( c.prefix === undefined ) continue;
            if( m.message.startsWith( c.prefix ) ) {
                customPrefix = true;
                break;
            }
        }

        return customPrefix ? m : false;
    },

    /**
     * The command parser. The default message consumer.
     * Is this.configured in #commandParserSettings
     * @see commandParserSettings
     * @param m Message object
     */
    commandParser( m, ...extra ) {
        // removes prefix
        m.message = m.message.replace( commandParserSettings.prefix, "" );
        const args = m.message.split(' ');

        const commandObject = commandParserSettings.commands.get(args[0]);
        if( commandObject ) {
            if( m.channel !== this.config.room &&
                (commandObject.global !== undefined && !commandObject.global) ) return;
            args.shift();
            return commandObject.command( m, ...args, ...extra );
        } else {
            $log.info( `No command ${args[0]} found` );
        }
    },

    pipedCommandParser(m) {
        if( !commandParserSettings.enablePipes ) return this.commandParser(m);

        const commands = m.message.split('|').map( x => x.trim() );

        const forgeMessage = string => {
            const c = JSON.parse( JSON.stringify( m ) );
            c.message = string;
            return c;
        };

        const forceShift = commands.shift();
        const initial = x => this.commandParser( forgeMessage( forceShift ) );

        const subsequents = commands.map( x => y => this.commandParser( forgeMessage( x ), y ) );

        //probably lol
        const result = subsequents.reduce(
            ( acc, x ) => {
                if( !acc ) {
                    return x( );
                } else if( typeof acc === "string" ) {
                    return x( acc );
                } else if( acc[0] ) {
                    return x( acc[0] );
                }
                return undefined;
            },
            initial()
        );

        return result;
    }, 
};
