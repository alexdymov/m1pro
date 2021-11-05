import { gameStarter } from './game';
import { mainStarter } from './main';

export class Starter {
    path = window.location.pathname;
    game = this.path.startsWith('/table') || (this.path.startsWith('/m1tv') && window.location.hash !== '');

    start() {
        if (this.game) {
            gameStarter();
        } else {
            mainStarter();
        }
    }
}