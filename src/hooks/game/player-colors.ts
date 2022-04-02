import GameState from '../../components/game-state';
import { Player } from '../../components/game-state';
import { debug } from '../../util/debug';

export class PlayerColors {
    private changed = false;

    constructor(private state: GameState) {
        state.$watch('needFixColor', change => {
            change && state.settings.changeColor && this.init();
        })
        state.$watch('settings.changeColor', change => {
            change && !this.changed && this.init();
            !change && this.changed && this.rollback();
        });
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
        const tokens = jQuery('div.table-body-board-tokens').children();
        tokens.detach();
        this.state.players.filter(pl => pl.token = tokens.get(this.getOrderForDirection(pl, !direction))).sort((a, b) => this.getOrderForDirection(a, direction) - this.getOrderForDirection(b, direction)).forEach(pl => {
            jQuery('div.table-body-board-tokens').append(pl.token);
        });
    }
}