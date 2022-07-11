import GameState from '../../components/game-state';
import mutator from '../../util/mutator';
import { debug } from '../../util/debug';

export class TableChat {
    private kRegExp = new RegExp(/(\d)k/);
    constructor(private state: GameState) {
        const chat = jQuery('div.table-body-board-chat div.scr-content');
        mutator.mutateAdded(chat, jq => {
            const id = jq.find('span[mnpl-userid]:first').mnpl('userid');
            if (id === '2750164' || id === '2621672') {
                jq.get(0).childNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE && node.nodeValue.indexOf('занимает второе место') !== -1) {
                        node.nodeValue = node.nodeValue.replace(/второе место/, "❤️первое❤️ место");
                    }
                });
            }
            jq.get(0).childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE && this.kRegExp.test(node.nodeValue)) {
                    node.nodeValue = node.nodeValue.replace(this.kRegExp, '$1');
                }
            });
        });
    }
}