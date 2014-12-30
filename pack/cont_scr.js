var TrelloGo = can.Control.extend( {
  defaults : {
      data: new can.Map( {
          appkey: undefined,
          logged_in: false,
          script_loaded: false,
          cards_received: false,
          settings_show_nrs: true,
          settings_move_labels: true,
          settings_show_tags: true,
          my_full_name: '',
          card_count: 'Loading...',
          card_count_filtered: 'Loading...',
          cards: [],
          boards: [],
          lists: [],
          columns: [
              {
                  nr: 0,
                  name: 'Unplannend'
              },
              {
                  nr: 3,
                  name: 'Someday'
              },
              {
                  nr: 1,
                  name: 'Soon'
              },
              {
                  nr: 2,
                  name: 'Now'
              }
          ]
      } )
  }
}, {
    init: function( /*element , options*/ ) {
        var self = this;
        var sdat = self.options.data;

        self.updateCardsStatusThrottledObject = throttle( $.proxy( self.updateCardsStatus, self ), 100 );

        $.get( chrome.extension.getURL( 'template_card.mus' ), function( data ) {
            self.templateCard = data;
        } );

        self.loadSettings();
        self.addUINodes();
        self.getAppKey();

        document.addEventListener( 'TrelloGoEvent2', function( ev ) {
            if( ev.detail.act === 'initDone' ) {
                sdat.attr( 'my_full_name', ev.detail.fullname );
            }

            if( ev.detail.act === 'newCards' ) {
                self.newCards( ev.detail.cards );
            }

            if( ev.detail.act === 'newBoards' ) {
                self.newBoards( ev.detail.boards );
            }

            if( ev.detail.act === 'newLists' ) {
                self.newLists( ev.detail.lists );
            }

            if( ev.detail.act === 'boardFound' ) {
                self.boardFound( ev.detail.board );
            }

            if( ev.detail.act === 'listFound' ) {
                self.listFound( ev.detail.list );
            }

            if( ev.detail.act === 'seLoggedIn' ) {
                sdat.attr( 'logged_in', ev.detail.logged_in );
            }

            if( ev.detail.act === 'trelloScriptLoaded' ) {
                sdat.attr( 'script_loaded', true );
            }
        } );

        self.on();
    },

    ////////////////////////////////////////

    '#trellogo_connect click': function() {
        this.sendEvt( { 'act': 'connect' } );
    },

    ////////////////////////////////////////

    '#trellogo_disconnect click': function() {
        var self = this;
        var sdat = self.options.data;

        self.storeageSet( 'trellogo_appkey', '' );
        sdat.attr( 'appkey', '' );
        this.sendEvt( { 'act': 'logout' } );
    },

    ////////////////////////////////////////

    '#trellogo_appkey_submit click': function() {
        var self = this;
        var sdat = self.options.data;
        var val = $( '.trellogo_appkey_input' ).val();

        sdat.attr( 'appkey', val );
        self.storeageSet( 'trellogo_appkey', val );
        this.getAppKey();
    },

    ////////////////////////////////////////

    '#trellogo_main_toggle click': function() {
        var h = $( window ).height() - 350;
        var $canvas = $( '.board-canvas' );
        var $main = $( '#trellogo_main' );
        if( $main.css( 'display' ) === 'none' ) {
            $main.css( 'display', 'inherit' );
            $main.css( 'height', h );
            $canvas.height( $canvas.height() - h );
        } else {
            $main.css( 'display', 'none' );
            $canvas.height( $canvas.height() + h );
        }
    },

    ////////////////////////////////////////

    '#trellogo_id_search click': function() {
        var self = this;
        chrome.runtime.sendMessage( { type: 'trellogo_get_from_clipboard' }, function( response ) {
            var val = response.text;

            if( val.length === 8 ) {
                val = '/c/' + val;
                self.sendEvt( { 'act': 'openCard', 'url': val } );
            }
        } );
    },

    ////////////////////////////////////////

    '#trellogo_settings_toggle click': function() {
        var self = this;
        var sdat = self.options.data;

        $.get( chrome.extension.getURL( 'template_settings.mus' ), function( data ) {
            var template = can.view( can.mustache( data ), sdat );

            $( 'body' ).append( template );

            $.fn.tabbedDialog = function () {
                this.tabs();
                this.dialog( {
                    modal: true,
                    width: $( window ).width() * 0.8,
                    height: $( window ).height() * 0.8,
                    buttons: {
                        'Done': function() {
                            $( this ).dialog( 'close' );
                            $( "#trellogo_settings_dialog" ).remove();

                            this.updateCardsStatusThrottledObject();
                        }
                    }
                } );
                this.find('.ui-tab-dialog-close').append($('a.ui-dialog-titlebar-close'));
                this.find('.ui-tab-dialog-close').css({'position':'absolute','right':'0', 'top':'23px'});
                this.find('.ui-tab-dialog-close > a').css({'float':'none','padding':'0'});
                var tabul = this.find('ul:first');
                this.parent().addClass('ui-tabs').prepend(tabul).draggable('option','handle',tabul);
                this.siblings('.ui-dialog-titlebar').remove();
                tabul.addClass('ui-dialog-titlebar');
            };

            $( "#trellogo_settings_dialog" ).tabbedDialog();
        } );
    },

    ////////////////////////////////////////

    '#trellogo_refresh_toggle click': function() {
        this.sendEvt( { 'act': 'getAll' } );
    },

    ////////////////////////////////////////

    '.trellogo_set_board_toggle click': function( el/*, ev*/ ) {
        var board = this.getById( 'boards', $( el ).attr( 'data-trellogo-boad-id' ) );

        if( typeof board !== 'undefined' ) {
            board.attr( 'tg_opened', ! board.attr( 'tg_opened' ) );
        }
    },

    ////////////////////////////////////////

    '.trellogo_set_show_nrs click': function( el/*, ev*/ ) {
        var self = this;
        var sdat = self.options.data;

        sdat.attr( 'settings_show_nrs', ! sdat.attr( 'settings_show_nrs' ) );
        self.storeageSet( 'trellogo_set_show_nrs', sdat.attr( 'settings_show_nrs' ) );
    },

    ////////////////////////////////////////

    '.trellogo_set_move_labels click': function( el/*, ev*/ ) {
        var self = this;
        var sdat = self.options.data;

        sdat.attr( 'settings_move_labels', ! sdat.attr( 'settings_move_labels' ) );
        self.storeageSet( 'trellogo_set_move_labels', sdat.attr( 'settings_move_labels' ) );
    },

    ////////////////////////////////////////

    '.trellogo_set_show_tags click': function( el/*, ev*/ ) {
        var self = this;
        var sdat = self.options.data;

        sdat.attr( 'settings_show_tags', ! sdat.attr( 'settings_show_tags' ) );
        self.storeageSet( 'trellogo_set_show_tags', sdat.attr( 'settings_show_tags' ) );
    },

    ////////////////////////////////////////

    '.trellogo_set_board_check mouseup': function( el ) {
        var self = this;
        var board = this.getById( 'boards', $( el ).parent().prev().attr( 'data-trellogo-boad-id' ) );

        if( typeof board !== 'undefined' ) {
            board.attr( 'tg_unchecked', ! board.attr( 'tg_unchecked' ) );
            self.storeageSet( 'trellogo_board_' + board.id + '_unchecked', board.attr( 'tg_unchecked' ) );
        }

        this.updateCardsStatusThrottledObject();
    },

    ////////////////////////////////////////

    '.trellogo_set_list_check mouseup': function( el ) {
        var self = this;
        var list = this.getById( 'lists', $( el ).parent().attr( 'data-trellogo-list-id' ) );

        if( typeof list !== 'undefined' ) {
            list.attr( 'tg_lunchecked', ! list.attr( 'tg_lunchecked' ) );
            self.storeageSet( 'trellogo_list_' + list.id + '_unchecked', list.attr( 'tg_lunchecked' ) );
        }

        this.updateCardsStatusThrottledObject();
    },

    ////////////////////////////////////////

    '.trellogo_card click': function( el ) {
        var card = this.getById( 'cards', $( el ).attr( 'data-trellogo-card-id' ) );

        if( typeof card !== 'undefined' ) {
            this.sendEvt( { 'act': 'openCard', 'url': card.url } );
        }
    },

    ////////////////////////////////////////

    updateCardsStatus: function() {
        var self = this;
        var sdat = self.options.data;

        setTimeout( function() {
            var count = 0;
            var orderChanged = false;

            if( sdat.attr( 'cards' ) ) {
                sdat.attr( 'cards' ).forEach( function( card ) {
                    var board = self.getById( 'boards', card.idBoard );
                    var list = self.getById( 'lists', card.idList );

                    if( ! ( parseInt( card.attr( 'tg_column' ) , 10 ) >= 0 ) ) {
                        var key = 'trellogo_card_' + card.id + '_column';
                        self.storeageGet( key, function( result ) {
                            var key = Object.keys( result )[0];
                            if( result[ key ] ) {
                                card.attr( 'tg_column', result[ key ] );
                            } else {
                                card.attr( 'tg_column', 0 );
                            }
                        } );

                    }

                    if( ! ( parseInt( card.attr( 'tg_order' ) , 10 ) >= 0 ) ) {
                        var key = 'trellogo_card_' + card.id + '_order';
                        self.storeageGet( key, function( result ) {
                            var key = Object.keys( result )[ 0 ];
                            var n = 0;
                            if( result[ key ] ) {
                                n = result[ key ];
                            }

                            if( card.attr( 'tg_order' ) != n ) {
                                card.attr( 'tg_order', n );
                                orderChanged = true;
                            }
                        } );
                    } else {
                        if( card.attr( 'tg_order_temp' ) >= 0 && card.attr( 'tg_order' ) != card.attr( 'tg_order_temp' ) ) {
                            card.attr( 'tg_order', card.attr( 'tg_order_temp' ) );
                            orderChanged = true;
                        }
                    }

                    if( typeof board !== 'undefined' && typeof list !== 'undefined' ) {

                        if( self.boardsFound && self.listsFound ) {
                            var sh = true;
                            if( board.attr( 'tg_unchecked' ) === true || list.attr( 'tg_lunchecked' ) === true ) {
                                sh = false;
                            }

                            if( card.attr( 'tg_show' ) !== sh ) {
                                card.attr( 'tg_show', sh );
                                orderChanged = true;
                            }

                        }
                    }

                    if( card.attr( 'tg_show' ) === true ) {
                        count++;
                    }
                } );

                setTimeout( function() {
                    if( orderChanged ) {
                        //console.log( "orderChanged" );

                        if( sdat.attr( 'cards' ) ) {
                            var cnt2 = 0;
                            var cnt3 = 0;
                            var cnt4 = 0;
                            sdat.attr( 'cards' ).forEach( function( card ) {

                                if( card.attr( 'tg_show' ) === true ) {
                                    cnt2++;
                                    if( card.attr( 'tg_added_page' ) !== 'added' ) {
                                        cnt3++;
                                        card.attr( 'tg_added_page', 'added' )
                                        setTimeout( function() {
                                            var template = can.view( can.mustache( self.templateCard ), card );

                                            $( '.trellogo_column_inner:first' ).append( template );
                                        }, 1 );
                                    }
                                } else {
                                    if( card.attr( 'tg_added_page' ) === 'added' ) {
                                        cnt4++;
                                        $( '.trellogo_card[data-trellogo-card-id="' + card.id + '"]' ).remove();
                                        card.attr( 'tg_added_page', 'removed' );
                                    }
                                }

                            } );
                            //console.log( "adding", cnt2, cnt3, cnt4 );

                        }

                        setTimeout( function() {
                            $( '.trellogo_column_inner' ).each( function( ii, el ) {
                                var $column = $( el );
                                $column.find( '.trellogo_card' ).each( function( ii, el ) {
                                    var $card = $( el );
                                    var card = self.getById( 'cards', $card.attr( 'data-trellogo-card-id' ) );
                                    var done = false;
                                    setTimeout( function() {
                                        $( '.trellogo_column_inner' ).each( function( ii, el ) {
                                            if( $( el ).attr( 'data-trellogo-column-nr' ) == card.attr( 'tg_column' ) ) {
                                                var $column2 = $( el );
                                                $column2.find( '.trellogo_card' ).each( function( ii, el ) {
                                                    if( !done ) {
                                                        var $card2 = $( el );
                                                        var card2 = self.getById( 'cards', $card2.attr( 'data-trellogo-card-id' ) );
                                                        if( $card.is( $card2 ) ) {
                                                            done = true;
                                                        }
                                                        if( !done && card2.attr( 'tg_order' ) > card.attr( 'tg_order' ) ) {
                                                            $card.insertBefore( $card2 );
                                                            done = true;
                                                        }
                                                    }
                                                } );
                                                if( !done ) {
                                                    $column2.append( $card );
                                                }
                                            }
                                        } );
                                    }, 1 );
                                } );
                            } );
                        }, 100 );
                    }
                }, 1000 );
            }

            //console.log( "count", count );

            if( sdat.attr( 'cards_received' ) && sdat.attr( 'boards' ).length > 0 && sdat.attr( 'lists' ).length > 0 ) {
                sdat.attr( 'card_count_filtered', count );
                sdat.attr( 'card_count', sdat.attr( 'cards' ).length );
            }
        }, 100 );

    },

    ////////////////////////////////////////

    loadSettings: function() {
        var self = this;
        var sdat = self.options.data;

        self.storeageGet( [ 'trellogo_set_show_nrs', 'trellogo_set_move_labels', 'trellogo_set_show_tags' ], function( result ) {
            if( typeof result.trellogo_set_show_nrs !== 'undefined' ) {
                sdat.attr( 'settings_show_nrs', result.trellogo_set_show_nrs );
            }

            if( typeof result.trellogo_set_move_labels !== 'undefined' ) {
                sdat.attr( 'settings_move_labels', result.trellogo_set_move_labels );
            }

            if( typeof result.trellogo_set_show_tags !== 'undefined' ) {
                sdat.attr( 'settings_show_tags', result.trellogo_set_show_tags );
            }

            self.addIntervalFunctions();
        } );
    },

    ////////////////////////////////////////

    addIntervalFunctions: function() {
        var self = this;
        var sdat = self.options.data;

        setInterval( function() {
            self.intervalAddMainToggle();

            if( sdat.attr( 'settings_show_nrs' ) ) {
                self.intervalAddCardNumbers();
            }

            self.intervalAddListTotals();

            if( sdat.attr( 'settings_show_tags' ) ) {
                self.intervalAddTags();
            }

            if( sdat.attr( 'settings_move_labels' ) ) {
                self.intervalMoveLabels();
            }

            self.intervalDrag();
        }, 1000 );
    },

    ////////////////////////////////////////

    intervalDrag: function() {
        var self = this;

        $( '.trellogo_card:not(.trellogo_drag_added)' ).each( function( ii, el ) {
            $( el ).addClass( 'trellogo_drag_added' ).draggable( {
                connectToSortable: '.trellogo_column_inner'
            } );
        } );

        $( '.trellogo_column_inner:not(.trellogo_drag_added)' ).each( function( ii, el ) {
            $( el ).addClass( 'trellogo_drag_added' ).sortable( {
                connectWith: '.trellogo_column_inner',
                placeholder: 'trellogo_sortable_placeholder',
                start: function( e, ui ){
                     ui.placeholder.height( ui.helper.height() );
                },
                stop: function( /*event, ui*/ ) {
                    setTimeout( function() {
                        $( '.trellogo_column_inner' ).each( function( i, el ) {
                            var $columnInner = $( el );
                            $columnInner.find( '.trellogo_card' ).each( function( j, el ) {
                                var card = self.getById( 'cards', $( el ).attr( 'data-trellogo-card-id' ) );

                                if( typeof card !== 'undefined' ) {
                                    if( card.attr( 'tg_order' ) != j + 1 ) {
                                        self.storeageSet( 'trellogo_card_' + card.id + '_order', j + 1 );
                                    }

                                    var newColNr = $columnInner.attr( 'data-trellogo-column-nr' );
                                    if( card.attr( 'tg_column' ) !== newColNr ) {
                                        self.storeageSet( 'trellogo_card_' + card.id + '_column', newColNr );
                                    }

                                    card.attr( 'tg_column', newColNr );
                                    card.attr( 'tg_order_temp', j + 1 );
                                }
                            } );
                        } );

                        self.updateCardsStatus();
                    }, 1 );
                }
            } );
        } );
    },

    ////////////////////////////////////////

    intervalMoveLabels: function() {
        var self = this;

        $( '.list-card > .list-card-labels:not(.trellogo_label_list)' ).each( function( ii, el ) {
            var $cardLabels = $( el );
            var $card = $cardLabels.closest( '.list-card' );
            var $cardBadges = $card.find( '.badges' );
            var $firstTag = $cardBadges.find( '.trellogo_tag:first' );

            if( $firstTag.length > 0 ) {
                $firstTag.before( $cardLabels );
            } else {
                $cardBadges.append( $cardLabels );
            }

            $cardLabels.removeClass( 'clearfix' );
            $cardLabels.addClass( 'trellogo_label_list' );
        } );
    },

    ////////////////////////////////////////

    intervalAddTags: function() {
        var self = this;

        $( '.list-card-title' ).each( function( ii, el ) {
            var $cardTitle = $( el );
            var title = $cardTitle.html();
            var titleBackup = $cardTitle.attr( 'data-trellogo-title' );
            if( title !== titleBackup ) {
                var titleParts = title.split( '{' );
                if( titleParts.length > 1 ) {
                    var $card = $cardTitle.closest( '.list-card' );
                    var $cardBadges = $card.find( '.badges' );
                    var labels = [];

                    $cardBadges.find( '.trellogo_tag' ).remove();

                    $.each( titleParts, function( i, titlePart ) {
                        if( i > 0 ) {
                            var titleParts2 = titlePart.split( '}' );
                            $cardBadges.append( '<div class="badge trellogo_tag aaa">' + titleParts2[ 0 ] + '</div>' );

                            var re = new RegExp( '{' + titleParts2[ 0 ] + '}', 'g' );
                            title = title.replace( re, '' );

                            labels.push( titleParts2[ 0 ] );
                        }
                    } );

                    $.each( $cardBadges.find( '.trellogo_tag' ), function( ii, label ) {
                        if( $.inArray( $( label ).text(), labels ) < 0 ) {
                            $( label ).remove();
                        }
                    } );

                    $cardTitle.html( title );
                    $cardTitle.removeClass( 'trellogo_id_added' );
                }
                $cardTitle.attr( 'data-trellogo-title', title );
            }
        } );
    },

    ////////////////////////////////////////

    intervalAddListTotals: function() {
        var self = this;

        $( '.list' ).each( function( ii, el ) {
            var $list = $( el );
            var aListTotal = parseInt( $list.find( '.list-header-num-cards' ).text(), 10 );
            var aListFiltered = $list.find( '.list-card:not(.hide)' ).length;
            if( ! ( aListTotal >= 0 ) ) {
                aListTotal = 0;
            }

            if( $list.find( '.trellogo_list_count' ).length <= 0 ) {
                $list.find( '.list-header-num-cards' ).after( '<p class="trellogo_list_count"></p>' );
            }

            var s = '';
            if( aListFiltered === aListTotal ) {
                s = aListTotal;
            } else {
                s = aListFiltered + ' / ' + aListTotal;
            }
            if( $list.find( '.trellogo_list_count' ).html() !== s ) {
                $list.find( '.trellogo_list_count' ).html( s );
            }
        } );
    },

    ////////////////////////////////////////

    intervalAddMainToggle: function() {
        var self = this;
        var sdat = self.options.data;

        if( $( '#trellogo_main_toggle' ).length <= 0 ) {
            $.get( chrome.extension.getURL( 'template_toggle.mus' ), function( data ) {
                var template = can.view( can.mustache( data ), sdat );

                $( '.header-search' ).after( template );
            } );
        }
    },

    ////////////////////////////////////////

    intervalAddCardNumbers: function() {
        var self = this;

        $( '.list-card-title:not(.trellogo_id_added)' ).each( function( ii, el ) {
            var href = $( el ).attr( 'href' );
            var hrefParts = href.split( '/' );
            var $cardID = $( el ).find( '.card-short-id' );

            if( $cardID.length > 0 ) {
                if( $( el ).find( '.trellogo_card_sid' ).length <= 0 ) {
                    $cardID.append( ' <span class="trellogo_card_sid">' + hrefParts[ 2 ] + '</span>' );
                    $cardID.css( 'display', 'block' );
                    $cardID.css( 'font-weight', 'bold' );
                }
                $( el ).addClass( 'trellogo_id_added' );
            }

            $( el ).find( '.trellogo_card_sid' ).click( function( ev ) {
                chrome.runtime.sendMessage( {
                    type: 'trellogo_copy_to_clipboard',
                    text: $( ev.target ).text()
                } );

                return false;
            } );
        } );
    },

    ////////////////////////////////////////

    addUINodes: function() {
        var self = this;
        var sdat = self.options.data;

        $.get( chrome.extension.getURL( 'template.mus' ), function( data ) {
            var template = can.view( can.mustache( data ), sdat );

            $( '#header' ).after( template );
        } );
    },

    ////////////////////////////////////////

    getAppKey: function() {
        var self = this;
        var sdat = self.options.data;

        self.storeageGet( 'trellogo_appkey', function( result ) {
            sdat.attr( 'appkey', result.trellogo_appkey );

            if( typeof result.trellogo_appkey === 'undefined' || result.trellogo_appkey === '' ) {
            } else {
                self.addTrelloScript( result.trellogo_appkey );
            }
        } );
    },

    ////////////////////////////////////////

    addTrelloScript: function( appkey ) {
        var self = this;

        // Add our script that runs INSIDE the page
        var s = document.createElement( 'script' );
        s.src = chrome.extension.getURL( 'script.js' );
        ( document.head || document.documentElement ).appendChild( s );
        s.onload = function() {
            self.sendEvt( { 'act': 'applyAppKey', 'appkey': appkey } );
        };
    },

    ////////////////////////////////////////

    sendEvt: function( data ) {
        var evt = document.createEvent( 'CustomEvent' );
        evt.initCustomEvent( 'TrelloGoEvent1', true, true, data );
        document.dispatchEvent( evt );
    },

    ////////////////////////////////////////

    newCards: function( cards ) {
        var self = this;
        var sdat = self.options.data;

        sdat.attr( 'cards_received', true );

        if( sdat.attr( 'cards' ) ) {
            sdat.attr( 'cards' ).forEach( function( card ) {
                card.attr( 'tg_temp_xs', 'pre' );
            } );
        }

        $.each( cards, function( ii, newCard ) {
            var card = self.getById( 'cards', newCard.id );
            if( typeof card !== 'undefined' ) {
                card.attr( newCard );
                card.removeAttr( 'tg_temp_xs' );
            } else {
                sdat.attr( 'cards' ).push( newCard );
            }
        } );

        self.storeageGet( null, function( items ) {
            var allKeys = Object.keys( items );

            if( sdat.attr( 'cards' ) ) {
                sdat.attr( 'cards' ).forEach( function( card ) {
                    if( card.attr( 'tg_temp_xs' ) === 'pre' ) {
                        $( '.trellogo_card[data-trellogo-card-id="' + card.id + '"]' ).remove();

                        $.each( allKeys, function( ii, key ) {
                            if( key.indexOf( 'trellogo_card_' + card.id ) >= 0 ) {
                                chrome.storage.local.remove( key );
                            }
                        } );
                    }
                } );
            }

            sdat.attr( 'cards' ).replace(
                sdat.attr( 'cards' ).filter( function( card ) {
                    return card.attr( 'tg_temp_xs' ) !== 'pre';
                } )
            );
        } );

        this.updateCardsStatusThrottledObject();
    },

    ////////////////////////////////////////

    newBoards: function( boards ) {
        var self = this;

        $.each( boards, function( ii, newBoard ) {
            self.boardFound( newBoard );
        } );

        this.boardsFound = true;
    },

    ////////////////////////////////////////

    newLists: function( lists ) {
        var self = this;

        $.each( lists, function( ii, newList ) {
            self.listFound( newList );
        } );

        this.listsFound = true;
    },

    ////////////////////////////////////////

    boardFound: function( newBoard ) {
        var self = this;
        var sdat = self.options.data;
        var board = self.getById( 'boards', newBoard.id );

        if( typeof board === 'undefined' ) {
            sdat.attr( 'boards' ).push( newBoard );
        } else {
            board.attr( newBoard );
        }

        board = self.getById( 'boards', newBoard.id );

        self.storeageGet( 'trellogo_board_' + board.id + '_unchecked', function( result ) {
            board.attr( 'tg_unchecked', result[ 'trellogo_board_' + board.id + '_unchecked' ] );

            self.updateCardsStatusThrottledObject();
        } );

    },

    ////////////////////////////////////////

    listFound: function( newList ) {
        var self = this;
        var sdat = self.options.data;
        var list = self.getById( 'lists', newList.id );

        if( typeof list === 'undefined' ) {
            sdat.attr( 'lists' ).push( newList );
        } else {
            list.attr( newList );
        }

        list = self.getById( 'lists', newList.id );

        self.storeageGet( 'trellogo_list_' + list.id + '_unchecked', function( result ) {
            list.attr( 'tg_lunchecked', result[ 'trellogo_list_' + list.id + '_unchecked' ] );

            self.updateCardsStatusThrottledObject();
        } );
    },

    ////////////////////////////////////////

    getById: function( typ, id ) {
        var self = this;
        var sdat = self.options.data;
        var found = 0;
        var foundItem = undefined;

        sdat.attr( typ ).forEach( function( item ) {
            if( item.id === id ) {
                found++;
                foundItem = item;
            }
        } );

        return foundItem;
    },

    ////////////////////////////////////////

    getBoardData: function( boardId ) {
        var self = this;
        var sdat = self.options.data;

        if( typeof this.getById( 'boards', boardId ) === 'undefined' ) {
            sdat.attr( 'boards' ).push( { id: boardId, 'name': 'Loading...' } );
            this.sendEvt( { 'act': 'getBoardData', 'id': boardId } );
        }
    },

    ////////////////////////////////////////

    getListData: function( listId ) {
        var self = this;
        var sdat = self.options.data;

        if( typeof this.getById( 'lists', listId ) === 'undefined' ) {
            sdat.attr( 'lists' ).push( { id: listId, 'name': 'Loading...' } );
            this.sendEvt( { 'act': 'getListData', 'id': listId } );
        }
    },

    ////////////////////////////////////////

    viaRef: function( typ, key, val ) {
        var board = this.getById( typ, val );

        if( typeof board !== 'undefined' ) {
            return board.attr( 'name' );
        }

        return '';
    },

    ////////////////////////////////////////

    storeageSet: function( key, val ) {
        chrome.storage.local.set( { key: val } );
    },

    ////////////////////////////////////////

    storeageGet: function( key, func ) {
        chrome.storage.local.get( key, func );
    }

} );

////////////////////////////////////////

var now = (typeof Date.now === 'function')? Date.now : function(){
    return +(new Date());
};

////////////////////////////////////////

function throttle( fn, delay ){
    var context, timeout, result, args,
        cur, diff, prev = 0;
    function delayed(){
        prev = now();
        timeout = null;
        result = fn.apply(context, args);
    }
    function throttled(){
        context = this;
        args = arguments;
        cur = now();
        diff = delay - (cur - prev);
        if (diff <= 0) {
            clearTimeout(timeout);
            prev = cur;
            result = fn.apply(context, args);
        } else if (! timeout) {
            timeout = setTimeout(delayed, diff);
        }
        return result;
    }
    return throttled;
}

////////////////////////////////////////

$( function() {
    var trelloGo = new TrelloGo( $( 'body' ) );

    can.mustache.registerHelper( 'viaref', function( typ, key, val ) {
        return trelloGo.viaRef( typ, key, val() );
    } );

    can.mustache.registerHelper( 'eq', function( val, cmp, options ) {
        if( typeof( val ) === 'function' ) {
            val = val();
        }
        if( typeof( cmp ) !== 'string' ) {
            cmp = cmp();
        }

        if ( val == cmp ) {
            return options.fn( this );
        }

        return options.inverse( this );
    } )
} );

////////////////////////////////////////


