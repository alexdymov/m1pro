import Vue from 'vue';
import GameState from '../../components/game-state';
import { debug } from '../../util/debug';
import mutator from '../../util/mutator';

export class GameStats {
    private jq: JQuery<Element>;
    private rootOrig: JQuery<HTMLElement>;
    private root: JQuery<HTMLElement>;
    private stats: JQuery<HTMLElement>;
    private content: JQuery<HTMLElement>;
    private title: JQuery<HTMLElement>;
    private allRenderedSeparately = false;

    constructor(public base: Vue, private state: GameState) {
        this.jq = jQuery(base.$el);
        this.init();
    }

    private init() {
        require('../../style/game/game-stats.less');

        this.root = jQuery('<div class="table-body-stats"/>').appendTo('div.table-body');
        this.stats = jQuery('<div class="TableHelper-content"/>').appendTo(this.root);
        this.loadElements();
        this.state.$watch('storage.flags', () => {
            this.title = this.rootOrig.find('div._matchtitle');
            this.render();
            this.observeTabSwitch();
        });
        window.onresize = (e) => {
            this.render();
        };
    }

    private loadElements() {
        this.allRenderedSeparately = false;
        this.rootOrig = this.jq.find('div.TableHelper-content > div');
        this.content = this.rootOrig.find('div.TableHelper-content-stat');
        this.title = this.rootOrig.find('div._matchtitle');
        this.render();
    }

    private observeTabSwitch() {
        mutator.mutateAdded(this.rootOrig.parent(), el => {
            if (!el.has('div._matchtitle').length)
                return;
            if (this.allRenderedSeparately) {
                this.title.remove();
                this.content.remove();
            }
            this.loadElements();
        });
    }

    private render() {
        const renderSeparately = this.isEnoughWidth();
        const ctr = renderSeparately ? this.stats : this.rootOrig;
        const rerender = renderSeparately !== this.allRenderedSeparately;
        renderSeparately && this.root.show() || this.root.hide();
        rerender && this.content.detach().prependTo(ctr);
        this.title.length && rerender && this.title.detach().prependTo(ctr);
        this.title.length && (this.allRenderedSeparately = renderSeparately);
    }

    private isEnoughWidth() {
        return window.matchMedia('(min-aspect-ratio: 85/50)').matches;
    }
}