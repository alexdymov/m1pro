import GameState from '../../components/game-state';
import { Player } from '../../components/game-state';
import { debug } from '../../util/debug';

export class PlayerColors {
    private changed = false;
    private tokens: JQuery<HTMLElement>;

    constructor(private state: GameState) {
        require('../../style/game/player-tokens.less');
        state.$watch('loaded', _ => {
            if (!this.tokens) {
                this.initTokens();
            }
        });
        state.$watch('needFixColor', change => {
            change && state.settings.changeColor && this.init();
        });
        state.$watch('settings.changeColor', change => {
            change && !this.changed && this.init();
            !change && this.changed && this.rollback();
        });
    }

    private initTokens() {
        this.tokens = jQuery('div.table-body-board-tokens').children();
        this.state.players.forEach((pl, i) => {
            pl.token = this.tokens.get(i);
            jQuery(pl.token)
                .append('<div class="_skip"/>')
                .append('<div class="_back" />')
                .append('<div class="_cntr" />')
                .children().hide();
            const idx = this.state.storage.status.players.findIndex(spl => spl.user_id === pl.user_id);
            this.state.$watch(`storage.status.players.${idx}.doublesRolledAsCombo`, v => {
                const el = jQuery('div._cntr', pl.token);
                if (v !== 0) {
                    el.show().text(v);
                } else {
                    el.hide();
                }
            });
            this.state.$watch(() => {
                const spl = this.state.storage.status.players[idx];
                return spl.jailed ? spl.unjailAttempts : -1;
            }, v => {
                const el = jQuery('div._cntr', pl.token);
                if (v >= 0 && v < 3) {
                    el.show().text(3 - v);
                } else {
                    el.hide();
                }
            });
        });
        debug('players tokens', this.state.players.map(pl => pl.token));
    }

    private rollback() {
        this.applyCards(false);
        this.reorderTokens(false);
        this.changed = false;
    }

    private init() {
        this.applyCards(true);
        this.reorderTokens(true);
        this.changed = true;
    }

    private applyCards(direction: boolean) {
        jQuery('div.table-body-players-card').each((i, el) => {
            const jq = jQuery(el);
            const pl = this.state.players.find(pl => this.getOrderForDirection(pl, direction) === Number(jq.mnpl('order')));
            jq.mnpl('order', `${this.getOrderForDirection(pl, !direction)}`);
        });
    }

    private getOrderForDirection(pl: Player, direction: boolean) {
        return direction ? pl.orderOrig : pl.order;
    }

    private reorderTokens(direction: boolean) {
        if (!this.tokens) {
            this.initTokens();
        }
        this.tokens.detach();
        [...this.state.players]
            .sort((a, b) => this.getOrderForDirection(a, !direction) - this.getOrderForDirection(b, !direction)).forEach(pl => {
                jQuery('div.table-body-board-tokens').append(pl.token);
            });
    }
}