// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

/***

|''Name''|tw5.js|
|''Description''|Enables TiddlyWikiy syntax highlighting using CodeMirror|
|''Original Contributor''|PMario|
|''Author''|[[adithya-badidey|https://github.com/adithya-badidey]]|
|''Version''|0.1.8|
|''Status''|''stable''|
|''Source''|[[GitHub|https://github.com/adithya-badidey/TW5-codemirror-plus]]|
|''Documentation''|https://codemirror.tiddlyspace.com/|
|''License''|[[MIT License|http://www.opensource.org/licenses/mit-license.php]]|
|''Requires''|codemirror.js|
|''Keywords''|syntax highlighting color code mirror codemirror|

!! Tiddlywiki Metadata
Name: $:/plugins/tiddlywiki/codemirror/mode/tw5/tw5.js
Type: application/javascript
Additional Field:
module-type: codemirror
 
Info: CoreVersion parameter is needed for TiddlyWiki only!

***/

(function (mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
        mod(require("../../lib/codemirror"));
    else if (typeof define == "function" && define.amd) // AMD
        define(["../../lib/codemirror"], mod);
    else // Plain browser env
        mod(CodeMirror);
})(function (CodeMirror) {
    "use strict";

    CodeMirror.defineMode("tiddlywiki5", function () {
        // Tokenizer
        var textwords = {};

        var keywords = {
            "allTags": true, "closeAll": true, "list": true,
            "newJournal": true, "newTiddler": true,
            "permaview": true, "saveChanges": true,
            "search": true, "slider": true, "tabs": true,
            "tag": true, "tagging": true, "tags": true,
            "tiddler": true, "timeline": true,
            "today": true, "version": true, "option": true,
            "with": true, "filter": true
        };

        var isSpaceName = /[\w_\-]/i,
            reHR = /^\-\-\-\-+$/,                                 // <hr>
            reWikiCommentStart = /^\/\*\*\*$/,            // /***
            reWikiCommentStop = /^\*\*\*\/$/,             // ***/
            reBlockQuote = /^<<<$/,

            reJsCodeStart = /^\/\/\{\{\{$/,                       // //{{{ js block start
            reJsCodeStop = /^\/\/\}\}\}$/,                        // //}}} js stop
            reXmlCodeStart = /^<!--\{\{\{-->$/,           // xml block start
            reXmlCodeStop = /^<!--\}\}\}-->$/,            // xml stop

            reCodeBlockStart = /^\{\{\{$/,                        // {{{ TW text div block start
            reCodeBlockStop = /^\}\}\}$/,                 // }}} TW text stop

            reUntilCodeStop = /.*?\}\}\}/;

        function chain(stream, state, f) {
            state.tokenize = f;
            return f(stream, state);
        }

        function tokenBase(stream, state) {
            var sol = stream.sol(), // sol() -> Returns true only if the stream is at the start of the line.
                ch = stream.peek(); // Returns the next character in the stream without advancing it. Will return a null at the end of the line.

            state.block = false;        // indicates the start of a code block.

            // check start of  blocks
            if (sol && /[<\/\*{}\-]/.test(ch)) { //is at the start of a line and the next char is not
                if (stream.match(reCodeBlockStart)) {
                    state.block = true;
                    return chain(stream, state, twTokenCode);
                }
                if (stream.match(reBlockQuote)) {
                    stream.skipToEnd();
                    return 'quote';
                }
                if (stream.match(reWikiCommentStart) || stream.match(reWikiCommentStop))
                    return 'comment';
                if (stream.match(reJsCodeStart) || stream.match(reJsCodeStop) || stream.match(reXmlCodeStart) || stream.match(reXmlCodeStop))
                    return 'comment';
                if (stream.match(reHR))
                    return 'hr';
            }

            stream.next();
            if (sol && /[\/\*!#;:>|]/.test(ch)) {
                if (ch == "!") { // tw header
                    var result = "h1";
                    if (stream.eat("!")) // tw underline
                        result = "h2"
                    if (stream.eat("!")) // tw underline
                        result = "h3";
                    if (stream.eat("!")) // tw underline
                        result = "h4";
                    if (stream.eat("!")) // tw underline
                        result = "h5";

                    stream.skipToEnd();
                    return result;
                }

                if (ch == "*") { // tw list
                    stream.eatWhile('*');
                    return "comment";
                }
                if (ch == "#") { // tw numbered list
                    stream.eatWhile('#');
                    return "comment";
                }
                if (ch == ";") { // definition list, term
                    stream.eatWhile(';');
                    return "comment";
                }
                if (ch == ":") { // definition list, description
                    stream.eatWhile(':');
                    return "comment";
                }
                if (ch == ">") { // single line quote
                    stream.eatWhile(">");
                    return "quote";
                }
                if (ch == '|')
                    return 'header';
            }

            if (ch == '{' && stream.match(/\{\{/))
                return chain(stream, state, twTokenCode);

            // rudimentary html:// file:// link matching. TW knows much more ...
            if (/[hf]/i.test(ch) &&
                /[ti]/i.test(stream.peek()) &&
                stream.match(/\b(ttps?|tp|ile):\/\/[\-A-Z0-9+&@#\/%?=~_|$!:,.;]*[A-Z0-9+&@#\/%=~_|$]/i))
                return "link";

            // just a little string indicator, don't want to have the whole string covered
            if (ch == '"')
                return 'string';

            if (ch == '~')    // _no_ CamelCase indicator should be bold
                return 'brace';

            if (ch == "@") {    // check for space link. TODO fix @@...@@ highlighting
                stream.eatWhile(isSpaceName);
                return "link";
            }

            // Dont want numbers
            // if (/\d/.test(ch)) {        // numbers
            //   stream.eatWhile(/\d/);
            //   return "number";
            // }

            // if (ch == "/") { // tw invisible comment
            //   if (stream.eat("%")) {
            //     return chain(stream, state, twTokenComment);
            //   } else if (stream.eat("/")) { //
            //     return chain(stream, state, twTokenEm);
            //   }
            // }
            if (ch == "{" && stream.eat("{")) // tw underline
                return chain(stream, state, twTranslclude);

            if (ch == "[" && stream.eat("[")) // tw InternalLink
                return chain(stream, state, twInternalLink);

            if (ch == "_" && stream.eat("_")) // tw underline
                return chain(stream, state, twTokenUnderline);

            // strikethrough and mdash handling
            if (ch == "-" && stream.eat("-")) {
                // if strikethrough looks ugly, change CSS.
                if (stream.peek() != ' ')
                    return chain(stream, state, twTokenStrike);
                // mdash
                if (stream.peek() == ' ')
                    return 'brace';
            }

            if (ch == "'" && stream.eat("'")) // tw bold
                return chain(stream, state, twTokenStrong);

            // Commenting out macros for now.
            // if (ch == "<" && stream.eat("<")) // tw macro
            //   return chain(stream, state, twTokenMacro);

            // core macro handling
            stream.eatWhile(/[\w\$_]/);
            return textwords.propertyIsEnumerable(stream.current()) ? "keyword" : null
        }

        //   // tw invisible comment
        //   function twTokenComment(stream, state) {
        //     var maybeEnd = false, ch;
        //     while (ch = stream.next()) {
        //       if (ch == "/" && maybeEnd) {
        //         state.tokenize = tokenBase;
        //         break;
        //       }
        //       maybeEnd = (ch == "%");
        //     }
        //     return "comment";
        //   }

        // tw strong / bold
        function twTokenStrong(stream, state) {
            var maybeEnd = false,
                ch;
            while (ch = stream.next()) {
                if (ch == "'" && maybeEnd) {
                    state.tokenize = tokenBase;
                    break;
                }
                maybeEnd = (ch == "'");
            }
            return "strong";
        }

        // tw code
        function twTokenCode(stream, state) {
            var sb = state.block;

            if (sb && stream.current()) {
                return "comment";
            }

            if (!sb && stream.match(reUntilCodeStop)) {
                state.tokenize = tokenBase;
                return "comment";
            }

            if (sb && stream.sol() && stream.match(reCodeBlockStop)) {
                state.tokenize = tokenBase;
                return "comment";
            }

            stream.next();
            return "comment";
        }

        // Commenting this out while figuring out the clash with http://
        //   // tw em / italic
        //   function twTokenEm(stream, state) {
        //     var maybeEnd = false,
        //     ch;
        //     while (ch = stream.next()) {
        //       if (ch == "/" && maybeEnd) {
        //         state.tokenize = tokenBase;
        //         break;
        //       }
        //       maybeEnd = (ch == "/");
        //     }
        //     return "em";
        //   }

        // tw transclusions
        function twTranslclude(stream, state) {
            var maybeEnd = false,
                ch;
            while (ch = stream.next()) {
                if (ch == "}" && maybeEnd) {
                    state.tokenize = tokenBase;
                    break;
                }
                maybeEnd = (ch == "}");
            }
            return "transclude";
        }

        // tw internal links
        function twInternalLink(stream, state) {
            var maybeEnd = false,
                ch;
            while (ch = stream.next()) {
                if (ch == "]" && maybeEnd) {
                    state.tokenize = tokenBase;
                    break;
                }
                maybeEnd = (ch == "]");
            }
            return "internallink";
        }

        // tw underlined text
        function twTokenUnderline(stream, state) {
            var maybeEnd = false,
                ch;
            while (ch = stream.next()) {
                if (ch == "_" && maybeEnd) {
                    state.tokenize = tokenBase;
                    break;
                }
                maybeEnd = (ch == "_");
            }
            return "underlined";
        }

        // tw strike through text looks ugly
        // change CSS if needed
        function twTokenStrike(stream, state) {
            var maybeEnd = false, ch;

            while (ch = stream.next()) {
                if (ch == "-" && maybeEnd) {
                    state.tokenize = tokenBase;
                    break;
                }
                maybeEnd = (ch == "-");
            }
            return "strikethrough";
        }

        //  Commenting out macro while figuring out the clash with quotes
        //   function twTokenMacro(stream, state) {
        //     if (stream.current() == '<<') {
        //       return 'macro';
        //     }

        //     var ch = stream.next();
        //     if (!ch) {
        //       state.tokenize = tokenBase;
        //       return null;
        //     }
        //     if (ch == ">") {
        //       if (stream.peek() == '>') {
        //         stream.next();
        //         state.tokenize = tokenBase;
        //         return "macro";
        //       }
        //     }

        //     stream.eatWhile(/[\w\$_]/);
        //     return keywords.propertyIsEnumerable(stream.current()) ? "keyword" : null
        //   }

        // Interface
        return {
            startState: function () {
                return { tokenize: tokenBase };
            },

            token: function (stream, state) {
                if (stream.eatSpace()) return null;
                var style = state.tokenize(stream, state);
                return style;
            }
        };
    });

    CodeMirror.defineMIME("text/vnd.tiddlywiki", "tiddlywiki5");
});