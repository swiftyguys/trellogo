var trelloGo = {

    init: function() {
        var self = this;

        document.addEventListener( 'TrelloGoEvent1', function( ev ) {
            if( ev.detail.act === 'applyAppKey' ) {
                self.applyAppKey( ev.detail.appkey );
            }

            if( ev.detail.act === 'getAll' ) {
                self.getCards();
                self.getBoards();
            }

            if( ev.detail.act === 'getBoardData' ) {
                self.getBoardData( ev.detail.id );
            }

            if( ev.detail.act === 'getListData' ) {
                self.getListData( ev.detail.id );
            }

            if( ev.detail.act === 'connect' ) {
                self.connect();
            }

            if( ev.detail.act === 'logout' ) {
                self.logout();
            }

            if( ev.detail.act === 'openCard' ) {
                self.openCard( ev.detail.url );
            }
        } );
    },

    ////////////////////////////////////////

    openCard: function( url ) {
        var $myEl = $( ".list-card:last" );
        var $card = $( '<div class="list-card js-member-droppable ui-droppable">' +
                '<div class="list-card-details clearfix">' +
                    '<a class="list-card-title clear js-card-name" href="' + url + '">' +
                        'TRELLOGO TEMP...' +
                    '</a> ' +
                '</div>' +
            '</div>' )
            .insertAfter( $myEl );
        $card.find( '.list-card-title' )
            .click();
        setTimeout( function() {
            $card.remove();
        }, 100 );
    },

    ////////////////////////////////////////

    applyAppKey: function( appkey ) {
        var self = this;

        $.getScript( 'https://api.trello.com/1/client.js?key=' + appkey, function() {
            self.sendEvt( { 'act': 'trelloScriptLoaded' } );
            self.trelloLoaded();
        } );
    },

    ////////////////////////////////////////

    trelloLoaded: function() {
        var self = this;

        Trello.authorize( {
            interactive: false,
            success: function() {
                self.onAuthorize();
            }
        } );
        this.updateLoggedIn();
    },

    ////////////////////////////////////////

    onAuthorize: function() {
        var self = this;

        this.updateLoggedIn();

        Trello.members.get( 'me', function( member ){
            if( member ) {
                self.sendEvt( { 'act': 'initDone', fullname: member.fullName } );
            }

            self.getBoards();
            self.getCards();
        } );

    },

    ////////////////////////////////////////

    getCards: function() {
        var self = this;

        Trello.get( 'members/me/cards?fields=name,url,idBoard,idList', function( cards ) {
            self.sendEvt( { 'act': 'newCards', cards: cards } );
        } );
    },

    ////////////////////////////////////////

    getBoards: function() {
        var self = this;

        Trello.get( 'members/me/boards', function( boards ) {
            $.each( boards, function( ii, newBoard ) {
                self.getLists( newBoard );
            } );

            self.sendEvt( { 'act': 'newBoards', boards: boards } );
        } );
    },

    ////////////////////////////////////////

    getLists: function( board ) {
        var self = this;

        Trello.get( 'boards/' + board.id + '/lists', function( lists ) {
            self.sendEvt( { 'act': 'newLists', lists: lists } );
        } );
    },

    ////////////////////////////////////////

    getBoardData: function( id ) {
        var self = this;

        Trello.get( 'boards/' + id, function( board ) {
            self.sendEvt( { 'act': 'boardFound', board: board } );
        } );
    },

    ////////////////////////////////////////

    getListData: function( id ) {
        var self = this;

        Trello.get( 'lists/' + id, function( list ) {
            self.sendEvt( { 'act': 'listFound', list: list } );
        } );
    },

    ////////////////////////////////////////

    updateLoggedIn: function() {
        var isLoggedIn = Trello.authorized();

        this.sendEvt( { 'act': 'seLoggedIn', logged_in: isLoggedIn } );
    },

    ////////////////////////////////////////

    connect: function() {
        var self = this;

        Trello.authorize( {
            type: 'popup',
            name: 'TrelloGo',
            success: function() {
                self.onAuthorize()
            },
            error: function() {
                console.log( "error connect" );
            }
        } )
    },

    ////////////////////////////////////////

    logout: function() {
        Trello.deauthorize();
        this.updateLoggedIn();
    },

    ////////////////////////////////////////

    sendEvt: function( data ) {
        //console.log( "sendEvt from script", data );

        var evt = document.createEvent( 'CustomEvent' );
        evt.initCustomEvent( 'TrelloGoEvent2', true, true, data );
        document.dispatchEvent( evt );
    }

}

////////////////////////////////////////

trelloGo.init();
