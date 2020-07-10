# chat-bot-sdk
A simple chat bot SDK for [bitwave.tv]'s chat

Install it with.

```bash
npm install @bitwave/chat-bot-sdk
```
------

## Design

The exported object has three key properties:
 - `transformers` - an array of functions taking a Message object and either returning it, or a falsy value. They serve to transform the message
 - `filters` - an array of functions taking a Message object and either returning it, or a falsy value. They serve to filter out messages
 - `consumer` - The unary function called after transformations and filtering.

 Messages are first fed through transformers, then filtered, and then consumed.

 Transformers are functions that change the message somehow. For example, one of the
 default ones turns received HTML into Markdown. A transformer can deny a message by
 returning a falsy value, which causes it to get dropped.

 Filters are functions that approve messages according to a requirement. For example,
 one of the default ones checks if a message is visible. They do so by either returning
 the message (approve) or returning a falsy value (drop). They shouldn't change the
 message.

 The consumer is a function that takes the filtered, transformed message. By default,
 this is a function that `console.log`s it and sends it to the command parser.

### Command parser

The command parser is configured in the `commandParserSettings` object. It contains
the message `prefix`, a map of `commands` (command name -> function).

Command functions take two arguments: the message that triggered them, and an array of
arguments.
