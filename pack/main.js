"strict";

function init( win ) {
}

chrome.runtime.onMessage.addListener( function( request, sender, sendResponse ) {
    if( request && request.type == 'trellogo_copy_to_clipboard' ) {
        var input = document.createElement( 'textarea' );
        document.body.appendChild( input );
        input.value = request.text;
        input.focus();
        input.select();
        document.execCommand( 'Copy' );
        input.remove();
    }

    if( request && request.type == 'trellogo_get_from_clipboard' ) {
        var input = document.createElement( 'textarea' );
        document.body.appendChild( input );
        input.focus();
        input.select();
        document.execCommand( 'paste' );
        var result = input.value;
        input.remove();
        sendResponse( { text: result } );
    }
} );
