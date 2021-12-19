import Vue from 'vue';
import MainState from '../../components/main-state';
import { ItemData, ItemData2 } from '../../shared/beans';
import { debug } from '../../util/debug';

declare module 'vue/types/vue' {
    interface Vue {
        item: ItemData & ItemData2
    }
}

export class Item {
    private jq: JQuery<Element>;

    constructor(public base: Vue, private state: MainState) {
        this.jq = jQuery(base.$el);
        base.item && this.init(base.item);
    }

    private init(item: ItemData & ItemData2): void {
        require('../../style/main/item.less');

        // debug(JSON.parse(JSON.stringify(item)));

        const mark = jQuery('<div class="_flex _mark ion-ios-cart" />');
        this.jq.find('div._left').find('div._mark.ion-ios-cart').remove().end().append(mark);
        this.state.getItemPrice(item.item_proto_id ?? item.thing_prototype_id).then(price => mark.append(`<span>${price}</span>`));

        if (item.user_id === window.API.user.user_id) {
            this.state.lots.things.some(lot => {
                if (lot.thing_prototype_id === (item.item_proto_id ?? item.thing_prototype_id)) {
                    mark.css('color', 'green');
                    return true;
                }
            });
        }
    }
}