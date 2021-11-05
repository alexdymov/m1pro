import GameState from "../../components/game-state";

export class PlayerCardMenu {
    constructor(state: GameState) {
        require('../../style/game/player-card-menu.less');
        state.$watch('loaded', () => {
            this.removeMenuListeners();
        });
    }

    private removeMenuListeners() {
        jQuery(document).off("mouseleave mousedown touchstart mouseup touchend", ".table-body-players-card-body");
        jQuery(document).off("mouseup touchend", ".table-body-players-card-menu > div");
        jQuery('body').off('mousedown touchstart');
    }
}