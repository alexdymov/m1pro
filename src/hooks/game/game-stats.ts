import Vue from 'vue';
import GameState from '../../components/game-state';
import { debug } from '../../util/debug';

export class GameStats {
    private jq: JQuery<Element>;
    private root: JQuery<HTMLElement>;
    private stats: JQuery<HTMLElement>;
    private content: JQuery<HTMLElement>;
    private title: JQuery<HTMLElement>;
    private prevState = false;

    constructor(public base: Vue, private state: GameState) {
        this.jq = jQuery(base.$el);
        this.init();
    }

    private init() {
        require('../../style/game/game-stats.less');

        this.root = jQuery('<div class="table-body-stats"><div class="TableHelper-content"/></div>').appendTo('div.table-body');
        this.stats = this.root.find('div.TableHelper-content');
        this.content = this.jq.find('div.TableHelper-content-stat');
        this.state.$watch('storage.flags', () => {
            this.title = this.jq.find('div._matchtitle');
            this.render();
        });
        this.render();
        window.onresize = (e) => {
            this.render();
        };
    }

    private render() {
        const matches = window.matchMedia('(min-aspect-ratio: 85/50)').matches;
        const ctr = matches ? this.stats : jQuery('div.TableHelper div.TableHelper-content > div');
        const rerender = matches !== this.prevState;
        matches && this.root.show() || this.root.hide();
        rerender && this.content.detach().prependTo(ctr);
        this.title && rerender && this.title.detach().prependTo(ctr);
        this.title && (this.prevState = matches);
    }
}