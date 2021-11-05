import GameState from '../../components/game-state';

export class PlayerColors {
    constructor(private state: GameState) {
        state.$watch('needFixColor', need => {
            need && this.init()
        })
    }

    private init() {
        this.applyCards();
        this.reorderTokens();
    }

    private applyCards() {
        jQuery('div.table-body-players-card').each((i, el) => {
            const jq = jQuery(el);
            const pl = this.state.players.find(pl => pl.orderOrig === Number(jq.mnpl('order')));
            if (pl.order != pl.orderOrig) {
                jq.mnpl('order', `${pl.order}`);
            }
        });
    }

    private reorderTokens() {
        const tokens = jQuery('div.table-body-board-tokens').children();
        tokens.detach();
        this.state.players.filter(pl => pl.token = tokens.get(pl.orderOrig)).sort((a, b) => a.order - b.order).forEach(pl => {
            jQuery('div.table-body-board-tokens').append(pl.token);
        });
    }
}