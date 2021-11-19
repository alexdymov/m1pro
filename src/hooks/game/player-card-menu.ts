import GameState from "../../components/game-state";
import vooker from '../../util/vue-hooker';

export class PlayerCardMenu {
    constructor(state: GameState) {
        require('../../style/game/player-card-menu.less');
        state.$watch('loaded', () => {
            this.removeMenuListeners();
        });
        state.$watch('gameOver', v => v && jQuery('div.table-body-players-card-menu').hide());
    }

    private removeMenuListeners() {
        jQuery(document).off("mouseleave mousedown touchstart mouseup touchend", ".table-body-players-card-body");
        jQuery(document).off("mouseup touchend", ".table-body-players-card-menu > div");
        jQuery('body').off('mousedown touchstart');
    }
}