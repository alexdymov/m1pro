import { debug } from '../util/debug';

export class Adaptive {
    private blocks: JQuery<HTMLElement>;
    private chat: JQuery<HTMLElement>;
    private games: JQuery<HTMLElement>;
    private wide = false;

    constructor() {
        setTimeout(() => {
            this.init();
        }, 1);
        window.onresize = () => {
            // debug('onresize')
            this.match();
        }
    }

    private init() {
        require('../style/main/adaptive.css');
        this.locateBlocks();
        this.match();
    }

    private match() {
        if (window.matchMedia('(min-width: 2048px)').matches) {
            this.arrangeForWide();
            this.adaptColumns(6, 4);
        } else if (window.matchMedia('(min-width: 1900px)').matches) {
            this.arrangeForWide();
            this.adaptColumns(5, 5);
        } else if (window.matchMedia('(min-width: 1600px)').matches) {
            this.arrangeForWide();
            this.adaptColumns(4, 6);
        } else {
            this.arrangeForOriginal();
            this.defaultColumns();
        }
    }

    private arrangeForWide() {
        if (this.wide) return;
        const toappend = this.games.children('div:not(.VueGamesRooms):not(#ph-rooms)');
        // debug('arrange', toappend)
        toappend.each((i, item) => {
            this.chat.append(jQuery(item).detach());
        });
        this.wide = true;
    }

    private arrangeForOriginal() {
        if (!this.wide) return;
        const toappend = this.chat.children();
        // debug('dearrange', toappend)
        toappend.toArray().reverse().forEach(item => {
            this.games.prepend(jQuery(item).detach());
        });
        this.wide = false;
    }

    private adaptColumns(chat: number, games: number) {
        // debug('adapt', chat, games)
        this.blocks.removeClass().addClass('blocksbox').addClass('col-2');
        this.chat.removeClass().addClass('chatbox').addClass(`col-${chat}`);
        this.games.removeClass().addClass('gamebox').addClass(`col-${games}`);
    }

    private defaultColumns() {
        this.blocks.removeClass().addClass('col-4');
        this.chat.removeClass();
        this.games.removeClass().addClass('col-8');
    }

    private locateBlocks() {
        this.blocks = jQuery('.container > div.col-4:first');
        this.chat = jQuery(`<div/>`);
        this.games = jQuery('.container > div.col-8:first');
        jQuery('.container').first().append(this.chat);
    }
}